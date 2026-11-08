/* ---------- ConcurrentHashMap: a port of the JDK 21 put, remove and transfer logic ---------- */
const chmSpread = h => (h ^ (h >>> 16)) & 0x7fffffff;
function chmNew() { return {tab:null, size:0, ctl:0, trees:{}, moved:{}}; }
function chmSizeFor(c) { let n = 1; while (n < c) n <<= 1; return n; }
function chmTransfer(m) {
  const tab = m.tab, n = tab.length, next = new Array(n * 2).fill(null);
  for (let i = n - 1; i >= 0; i--) {
    const f = tab[i];
    if (!f) continue;
    let runBit = f.hash & n, last = f;
    for (let p = f.next; p; p = p.next) { const b = p.hash & n; if (b !== runBit) { runBit = b; last = p; } }
    let ln = runBit === 0 ? last : null, hn = runBit === 0 ? null : last;
    for (let p = f; p !== last; p = p.next) {
      if ((p.hash & n) === 0) ln = {hash:p.hash, key:p.key, val:p.val, next:ln};
      else hn = {hash:p.hash, key:p.key, val:p.val, next:hn};
    }
    next[i] = ln; next[i + n] = hn;
    for (let p = hn; p; p = p.next) m.moved[p.key] = [i, i + n];
  }
  m.tab = next; m.ctl = (n << 1) - (n >>> 1);
}
function chmPut(m, key, val) {
  const ev = {key, val, hash:chmSpread(JHASH.str(key)), log:[]};
  m.moved = {};
  if (!m.tab) { m.tab = new Array(16).fill(null); m.ctl = 12; ev.log.push('init'); }
  let n = m.tab.length, i = (n - 1) & ev.hash, f = m.tab[i], bin = 0;
  ev.idx = i;
  if (!f) { m.tab[i] = {hash:ev.hash, key, val, next:null}; ev.log.push('cas'); }
  else {
    ev.log.push('lock');
    for (bin = 1, ev.old = undefined; ; bin++) {
      if (f.hash === ev.hash && f.key === key) { ev.old = f.val; f.val = val; ev.log.push('replace'); break; }
      if (!f.next) { f.next = {hash:ev.hash, key, val, next:null}; ev.log.push('append'); break; }
      f = f.next;
    }
    if (bin >= 8) {
      if (n < 64) {
        const c = chmSizeFor((n << 1) + n + 1);
        while (m.ctl >= 0 && c > m.ctl) { chmTransfer(m); }
        ev.log.push('presize');
      } else { m.trees[i] = true; ev.log.push('tree'); }
    }
    if (ev.old !== undefined) return ev;
  }
  m.size++;
  while (m.size >= m.ctl) { chmTransfer(m); ev.log.push('resize'); }
  return ev;
}
function chmRemove(m, key) {
  const ev = {key, hash:chmSpread(JHASH.str(key)), log:[]};
  if (!m.tab) { ev.log.push('none'); return ev; }
  const i = (m.tab.length - 1) & ev.hash; ev.idx = i;
  for (let p = m.tab[i], prev = null; p; prev = p, p = p.next) {
    if (p.hash === ev.hash && p.key === key) {
      if (prev) prev.next = p.next; else m.tab[i] = p.next;
      m.size--; ev.log.push('lock', 'removed'); m.moved = {}; return ev;
    }
  }
  ev.log.push('none');
  return ev;
}
function chmGet(m, key) {
  const ev = {key, hash:chmSpread(JHASH.str(key)), log:['nolock']};
  if (!m.tab) { ev.log.push('none'); return ev; }
  ev.idx = (m.tab.length - 1) & ev.hash;
  for (let p = m.tab[ev.idx]; p; p = p.next) if (p.hash === ev.hash && p.key === key) { ev.val = p.val; ev.log.push('found'); return ev; }
  ev.log.push('none');
  return ev;
}
function chmDump(m) {
  if (!m.tab) return 'cap=-1 size=0';
  const parts = [];
  m.tab.forEach((f, i) => { if (!f) return; const a = []; for (let p = f; p; p = p.next) a.push(p.key + '=' + p.val); parts.push(i + ':' + a.join(',')); });
  return `cap=${m.tab.length} size=${m.size} ctl=${m.ctl} ` + parts.join(' ');
}
const CHM_SCENES = {
  1: {base:[], steps:[
    {ops:[], hold:{}, wait:[], mark:'empty'},
    {ops:[['Aa', 1]], hold:{}, wait:[], mark:'a'},
    {ops:[['Aa', 1]], hold:{}, wait:[], mark:'bfail'},
    {ops:[['Aa', 1]], hold:{b:'B'}, wait:[], mark:'block'},
    {ops:[['Aa', 1], ['BB', 2]], hold:{}, wait:[], mark:'bdone'},
  ]},
  2: {base:[['Aa', 1]], steps:[
    {ops:[], hold:{}, wait:[], mark:'start'},
    {ops:[], hold:{b:'A'}, wait:[], mark:'alock'},
    {ops:[], hold:{b:'A'}, wait:['B'], mark:'bwait'},
    {ops:[['Leyla', 7]], hold:{b:'A'}, wait:['B'], mark:'cfree'},
    {ops:[['Leyla', 7], ['BB', 2]], hold:{}, wait:['B'], mark:'adone'},
    {ops:[['Leyla', 7], ['BB', 2]], hold:{b:'B'}, wait:[], mark:'block2'},
    {ops:[['Leyla', 7], ['BB', 2], ['C#', 3]], hold:{}, wait:[], mark:'bdone2'},
  ]},
};
const CHM_TRY = {0:[['Aysel', 20], ['Leyla', 25], ['Nigar', 30]], 3:[['Aysel', 20]], 4:Array.from({length:11}, (_, i) => ['k' + (i + 1), i + 1]), 5:[['visits', 1]]};
function chmTable(m, focusIdx, holdIdx, holder, waiters) {
  if (!m.tab) return `<p class="muted">${rich(lu('tableNull'))}</p>`;
  const rows = m.tab.map((f, i) => {
    const chips = [];
    for (let p = f; p; p = p.next) { const mv = m.moved[p.key]; chips.push(`${chips.length ? '<span class="nx">next</span>' : ''}<span class="nd"><b>"${esc(p.key)}"</b><i class="val">${p.val}</i>${mv ? `<small class="mv">${mv[0]} → ${mv[1]}</small>` : ''}</span>`); }
    const lock = i === holdIdx ? `<small class="lockb held">${esc(ls$('heldBy', holder))}</small>` : '';
    const wait = i === holdIdx && waiters.length ? `<small class="lockb">${esc(ls$('waiting', waiters.join(', ')))}</small>` : '';
    return `<div class="bk${i === focusIdx ? ' hit' : ''}${f ? '' : ' empty'}"><code class="bi">${i}</code>${chips.join('') || '<span class="nul">null</span>'}${m.trees[i] ? '<small class="tn">TreeBin</small>' : ''}${lock}${wait}</div>`;
  }).join('');
  const pct = Math.min(100, Math.round(m.size / m.ctl * 100));
  return `<div class="gauge"><div class="gtext"><span><code>size</code> <b>${m.size}</b></span><span><code>sizeCtl</code> <b>${m.ctl}</b></span><span><code>capacity</code> <b>${m.tab.length}</b></span></div><div class="gbar" role="img" aria-label="size ${m.size} / sizeCtl ${m.ctl}"><span style="width:${pct}%"></span></div></div><div class="bks">${rows}</div>`;
}
function chmBuild(ops) { const m = chmNew(); ops.forEach(o => chmPut(m, o[0], o[1])); return m; }
function chmTrace(ev) {
  if (!ev) return `<p class="muted">${rich(lu('tryHint'))}</p>`;
  const head = `<p class="pipekey"><b>"${esc(ev.key)}"</b></p><p class="result"><code>spread(hashCode)</code> = ${ev.hash}${ev.idx !== undefined ? ` · <code>index</code> = <b>${ev.idx}</b>` : ''}</p>`;
  return head + `<ul class="trace">${ev.log.map(k => `<li>${rich(ls$('t_' + k, ev))}</li>`).join('')}</ul>`;
}
LS.chm = {
  init(i) {
    if (CHM_SCENES[i]) return {i:0};
    const st = {m:chmNew(), ev:null, err:'', key:i === 3 ? 'Leyla' : i === 4 ? 'k12' : 'Murad', val:'30', code:(CHM_TRY[i] || []).map(o => `map.put("${o[0]}", ${o[1]});`)};
    (CHM_TRY[i] || []).forEach(o => { st.ev = chmPut(st.m, o[0], o[1]); });
    return st;
  },
  controls(st, ch) {
    if (CHM_SCENES[ch]) return lsStepper(st.i, CHM_SCENES[ch].steps.length - 1);
    return `<form class="tryit" data-submit="put" autocomplete="off"><h3>${esc(SITE[LANG].tryIt)}</h3><div class="tr-fields"><label><span>${esc(SITE[LANG].fKey)}</span><input id="chm-key" name="key" type="text" maxlength="40" spellcheck="false" autocapitalize="off" value="${esc(st.key)}"></label><label><span>${esc(SITE[LANG].fVal)}</span><input id="chm-val" name="val" type="text" inputmode="numeric" value="${esc(st.val)}"></label></div><div class="tr-acts"><button class="btn primary" type="submit">put</button><button class="btn" type="button" data-act="get">get</button><button class="btn" type="button" data-act="remove">remove</button><button class="btn" type="button" data-act="null">put(null, 1)</button></div><p class="tr-err" role="alert">${esc(st.err)}</p></form>`;
  },
  stage(st, ch) {
    if (CHM_SCENES[ch]) {
      const sc = CHM_SCENES[ch], s = sc.steps[st.i], m = chmBuild(sc.base.concat(s.ops));
      const idx = (16 - 1) & chmSpread(JHASH.str('Aa'));
      const holder = s.hold.b;
      return pnl(lu('table'), chmTable(m, idx, holder ? idx : -1, holder, s.wait) + `<p class="explain-s">${rich(lsX().ch[ch][2][st.i])}</p>`)
        + pnl('', ch === 1 ? `<p class="muted">${rich(lu('sameHash'))}</p>` : `<p class="muted">${rich(lu('sameHash2'))}</p>`);
    }
    let extra = '';
    if (ch === 0) extra = pnl(lu('lockScope'), `<table class="demo"><thead><tr><th>Map</th><th>${esc(lu('lockCol'))}</th><th>${esc(lu('nullCol'))}</th></tr></thead><tbody><tr><td><code>HashMap</code></td><td>${esc(lu('lockNone'))}</td><td>${esc(lu('yes'))}</td></tr><tr><td><code>Hashtable</code></td><td>${esc(lu('lockAll'))}</td><td>${esc(lu('no'))}</td></tr><tr><td><code>Collections.synchronizedMap</code></td><td>${esc(lu('lockAll'))}</td><td>${esc(lu('yes'))}</td></tr><tr><td><code>ConcurrentHashMap</code></td><td><b>${esc(lu('lockBin'))}</b></td><td>${esc(lu('no'))}</td></tr></tbody></table>`) + pnl('', measured(rich(lu('m0'))));
    if (ch === 3) extra = pnl('', measured(rich(lu('m3'))));
    if (ch === 4) extra = pnl('', `<table class="demo"><thead><tr><th>${esc(lu('resizeRow'))}</th><th><code>HashMap</code></th><th><code>ConcurrentHashMap</code></th></tr></thead><tbody><tr><td>${esc(lu('resizeAt'))}</td><td>13</td><td><b>12</b></td></tr><tr><td><code>new ...(16)</code></td><td>16</td><td><b>32</b></td></tr></tbody></table>` + measured(rich(lu('m4'))));
    if (ch === 5) extra = pnl(lu('compound'), `<pre class="logv">Integer old = map.get("c");           // ${esc(lu('c1'))}
map.put("c", old == null ? 1 : old + 1);

map.merge("c", 1, Integer::sum);      // ${esc(lu('c2'))}</pre>` + measured(rich(lu('m5'))));
    return pnl(lu('table'), chmTrace(st.ev) + chmTable(st.m, st.ev ? st.ev.idx : -1, -1, '', [])) + extra;
  },
  act(st, a, v, ch) {
    if (CHM_SCENES[ch]) { const n = CHM_SCENES[ch].steps.length - 1; if (a === 'next') st.i = Math.min(n, st.i + 1); if (a === 'prev') st.i = Math.max(0, st.i - 1); if (a === 'reset') st.i = 0; return; }
    const keyEl = $('chm-key'), valEl = $('chm-val');
    const key = v instanceof FormData ? v.get('key') : keyEl.value, raw = String(v instanceof FormData ? v.get('val') : valEl.value).trim();
    st.key = key; st.val = raw; st.err = '';
    if (a === 'null') { st.err = 'NullPointerException'; return; }
    if (!key) { st.err = SITE[LANG].errKey; return; }
    if (a === 'put') {
      if (!/^-?\d+$/.test(raw) || Math.abs(+raw) > 2147483647) { st.err = SITE[LANG].errVal; return; }
      if (st.m.size >= 60) { st.err = SITE[LANG].errMany; return; }
      st.ev = chmPut(st.m, key.slice(0, 40), +raw);
    }
    if (a === 'get') st.ev = chmGet(st.m, key);
    if (a === 'remove') st.ev = chmRemove(st.m, key);
  },
  text: {
    az: {title:'ConcurrentHashMap necə işləyir', door:'Bir neçə thread üçün HashMap. Boş bucket-də CAS, dolu bucket-də lock, resize və null qadağası.',
      ui:{table:'Table', tableNull:'`table` hələ null-dur: ilk put-da yaranacaq.', tryHint:'Solda key yaz və put bas.', heldBy:n => `Thread ${n} lock-dadır`, waiting:n => `${n} gözləyir`,
        t_init:() => 'Table ilk put-da yarandı: capacity 16, `sizeCtl` 12.', t_cas:() => 'Bucket boş idi: Node CAS ilə yazıldı, lock alınmadı.', t_lock:() => 'Bucket dolu idi: birinci Node üzərində `synchronized` alındı.', t_replace:e => `Key var idi: value ${e.val} oldu, size dəyişmədi.`, t_append:() => 'Node zəncirin sonuna əlavə olundu.', t_presize:() => 'Zəncir 8-ə çatdı, capacity 64-dən kiçikdir: table böyüdü.', t_tree:() => 'Zəncir 8-ə çatdı: bucket TreeBin oldu. Burada list kimi çəkilir.', t_resize:() => '`size` `sizeCtl`-a çatdı: table 2 dəfə böyüdü.', t_removed:() => 'Node silindi.', t_none:() => 'Key yoxdur: nəticə `null`.', t_nolock:() => '`get` lock almır: Node-un `val` və `next` field-ləri `volatile`-dır.', t_found:e => `Tapıldı: ${e.val}.`,
        sameHash:'`"Aa"` və `"BB"`-nin hash-i eynidir, ona görə eyni bucket-ə düşürlər.', sameHash2:'`"Aa"`, `"BB"` və `"C#"`-in hash-i eynidir (2112). `"Leyla"` isə başqa bucket-ə düşür.',
        lockScope:'Lock harada tutulur?', lockCol:'Lock', nullCol:'null key', lockNone:'yoxdur', lockAll:'bütün map üçün bir lock', lockBin:'yalnız bir bucket', yes:'olar', no:'NullPointerException',
        m0:'4 thread 400 000 key yazdı. `HashMap`: 232 091, 249 547, bir dəfə də thread-lər 5 saniyədən sonra hələ işləyirdi. `ConcurrentHashMap`: hər dəfə 400 000.', m3:'`put(null, 1)`, `put("x", null)` və `get(null)`: üçü də `NullPointerException` verdi.', m4:'JDK 21-də `table` field-i reflection ilə oxundu. `ConcurrentHashMap` 12-ci key-də 32 oldu, `HashMap` 13-cü key-də. `new ConcurrentHashMap<>(16)` isə 32 capacity yaradır.', m5:'2 thread 1 000 000 dəfə artırdı. `get` + `put`: 1 052 031. `merge`: 2 000 000.',
        resizeRow:'Fərq', resizeAt:'capacity 32 olan key', compound:'Tək əməliyyatlar təhlükəsizdir, ardıcıllıq yox', c1:'itki ola bilər', c2:'atomic'},
      ch:[
        ['Niyə HashMap kifayət etmir?', ['`HashMap` thread-safe deyil: eyni anda yazan thread-lər Node-ları itirə, resize-ı poza bilər.', '`Hashtable` hər method-u bir lock-a bağlayır: thread-lər fərqli bucket-lərlə işləsələr də, bir-birini gözləyirlər.', '`ConcurrentHashMap` lock-u bucket səviyyəsinə endirir: fərqli bucket-lər adətən bir-birinə mane olmur. Java 7-dəki Segment quruluşu Java 8-də ləğv olunub.']],
        ['Boş bucket: CAS', ['Bucket boşdursa, lock almağa ehtiyac yoxdur. Thread CAS işlədir: `null` idisə, Node-u yaz.', 'İki thread eyni boş bucket-ə yazırsa, biri qalib gəlir. Digərinin CAS-ı uğursuz olur və put yenidən başlayır: indi bucket doludur.'],
          ['İki thread eyni boş bucket-ə yazmaq istəyir.','Thread A CAS etdi: `"Aa"` yazıldı, lock alınmadı.','Thread B-nin CAS-ı uğursuz oldu, çünki bucket artıq `null` deyil. Thread dayanmır, yenidən yoxlayır.','İndi bucket doludur: Thread B ilk Node üzərində lock aldı.','Thread B `"BB"`-ni zəncirin sonuna yazdı və lock-u buraxdı.']],
        ['Dolu bucket: lock', ['Bucket doludursa, thread ilk Node üzərində `synchronized` alır. Lock yalnız bu bucket üçündür.', 'Eyni bucket-ə yazan thread gözləyir, başqa bucket-ə yazan isə gözləmir. `Hashtable`-dan əsas fərq budur.'],
          ['Bucket-də `"Aa"` var.','Thread A `"BB"` yazmaq üçün lock aldı.','Thread B `"C#"` yazmaq istəyir: eyni bucket-dir, gözləyir.','Thread C `"Leyla"` yazdı: başqa bucket-dir, heç kimi gözləmədi.','Thread A `"BB"`-ni yazdı və lock-u buraxdı.','Thread B lock-u aldı.','Thread B `"C#"`-i yazdı. Heç bir Node itmədi.']],
        ['Niyə null olmaz?', ['`HashMap`-də `get` `null` qaytaranda `containsKey` ilə yoxlaya bilərsən: key yoxdur, yoxsa value `null`-dur?', 'Çox thread-də bu iki çağırış arasında map dəyişə bilər, ona görə cavab etibarlı olmur. Bu qarışıqlıq olmasın deyə `ConcurrentHashMap` `null` key və `null` value qəbul etmir.', 'Solda `put(null, 1)` düyməsini bas.']],
        ['Resize: bir az tez və birlikdə', ['Burada 11 key var. Solda `k12` üçün put bas: table 12-ci key-də böyüyür. `HashMap` isə 13-cü key-də böyüyür.', 'Köçürmə zamanı köçürülmüş bucket-ə `ForwardingNode` qoyulur. `get` onun vasitəsilə yeni table-a keçir, `put` edən thread isə köçürməyə kömək edir.', 'Yerini dəyişən Node-lar sağda işarələnir. Node-lar bəzən zəncirdə tərs sıraya düşür, bu da JDK kodu ilə eynidir.']],
        ['Atomic əməliyyatlar və size', ['Hər çağırış ayrıca təhlükəsizdir, amma `get`, sonra `put` birlikdə atomic deyil: arada başqa thread yaza bilər.', 'Bunun üçün `merge`, `compute`, `computeIfAbsent` və `putIfAbsent` var.', '`size()` təxmini də ola bilər: sayğac `baseCount` və `CounterCell`-lərə bölünüb. Thread-lər yazarkən nəticə dəqiq olmaya bilər.']],
      ]},
    tr: {title:'ConcurrentHashMap nasıl çalışır', door:"Birden fazla thread için HashMap. Boş bucket'ta CAS, dolu bucket'ta lock, resize ve null yasağı.",
      ui:{table:'Table', tableNull:'`table` hâlâ null: ilk put çağrısında oluşacak.', tryHint:'Solda key yaz ve put bas.', heldBy:n => `Thread ${n} lock'ta`, waiting:n => `${n} bekliyor`,
        t_init:() => 'Table ilk put çağrısında oluştu: capacity 16, `sizeCtl` 12.', t_cas:() => 'Bucket boştu: Node CAS ile yazıldı, lock alınmadı.', t_lock:() => "Bucket doluydu: ilk Node üzerinde `synchronized` alındı.", t_replace:e => `Key vardı: value ${e.val} oldu, size değişmedi.`, t_append:() => 'Node zincirin sonuna eklendi.', t_presize:() => "Zincir 8'e ulaştı, capacity 64'ten küçük: table büyüdü.", t_tree:() => 'Zincir 8\'e ulaştı: bucket TreeBin oldu. Burada list olarak çizilir.', t_resize:() => "`size`, `sizeCtl` değerine ulaştı: table 2 katına çıktı.", t_removed:() => 'Node silindi.', t_none:() => 'Key yok: sonuç `null`.', t_nolock:() => "`get` lock almaz: Node'un `val` ve `next` field'ları `volatile`'dır.", t_found:e => `Bulundu: ${e.val}.`,
        sameHash:"`\"Aa\"` ve `\"BB\"` için hash aynıdır, bu yüzden aynı bucket'a düşerler.", sameHash2:"`\"Aa\"`, `\"BB\"` ve `\"C#\"` için hash aynıdır (2112). `\"Leyla\"` ise başka bucket'a düşer.",
        lockScope:'Lock nerede tutulur?', lockCol:'Lock', nullCol:'null key', lockNone:'yok', lockAll:'tüm map için bir lock', lockBin:'yalnızca bir bucket', yes:'olur', no:'NullPointerException',
        m0:"4 thread 400 000 key yazdı. `HashMap`: 232 091, 249 547, bir kez de thread'ler 5 saniye sonra hâlâ çalışıyordu. `ConcurrentHashMap`: her seferinde 400 000.", m3:"`put(null, 1)`, `put(\"x\", null)` ve `get(null)`: üçü de `NullPointerException` verdi.", m4:"JDK 21'de `table` field'ı reflection ile okundu. `ConcurrentHashMap` 12. key'de 32 oldu, `HashMap` 13. key'de. `new ConcurrentHashMap<>(16)` ise 32 capacity oluşturur.", m5:'2 thread 1 000 000 kez artırdı. `get` + `put`: 1 052 031. `merge`: 2 000 000.',
        resizeRow:'Fark', resizeAt:'capacity 32 olan key', compound:'Tek işlemler güvenlidir, ardışıklık değil', c1:'kayıp olabilir', c2:'atomic'},
      ch:[
        ['HashMap neden yetmez?', ["`HashMap` thread-safe değildir: aynı anda yazan thread'ler Node kaybedebilir, resize'ı bozabilir.", "`Hashtable` her method'u tek lock'a bağlar: thread'ler farklı bucket'larla çalışsa da birbirini bekler.", "`ConcurrentHashMap` lock'u bucket seviyesine indirir: farklı bucket'lar genellikle birbirini engellemez. Java 7'deki Segment yapısı Java 8'de kaldırıldı."]],
        ['Boş bucket: CAS', ["Bucket boşsa lock almaya gerek yoktur. Thread CAS kullanır: `null` ise Node'u yaz.", "İki thread aynı boş bucket'a yazarsa biri kazanır. Diğerinin CAS'ı başarısız olur ve put yeniden başlar: artık bucket doludur."],
          ["İki thread aynı boş bucket'a yazmak istiyor.","Thread A CAS yaptı: `\"Aa\"` yazıldı, lock alınmadı.","Thread B'nin CAS'ı başarısız oldu, çünkü bucket artık `null` değil. Thread durmaz, yeniden kontrol eder.","Artık bucket dolu: Thread B ilk Node üzerinde lock aldı.","Thread B `\"BB\"` değerini zincirin sonuna yazdı ve lock'u bıraktı."]],
        ['Dolu bucket: lock', ["Bucket doluysa thread ilk Node üzerinde `synchronized` alır. Lock yalnızca bu bucket içindir.", "Aynı bucket'a yazan thread bekler, başka bucket'a yazan beklemez. `Hashtable`'dan temel fark budur."],
          ["Bucket'ta `\"Aa\"` var.","Thread A `\"BB\"` yazmak için lock aldı.","Thread B `\"C#\"` yazmak istiyor: aynı bucket, bekliyor.","Thread C `\"Leyla\"` yazdı: başka bucket, kimseyi beklemedi.","Thread A `\"BB\"` yazdı ve lock'u bıraktı.","Thread B lock'u aldı.","Thread B `\"C#\"` yazdı. Hiçbir Node kaybolmadı."]],
        ['Neden null olmaz?', ["`HashMap`'te `get` `null` döndürünce `containsKey` ile bakabilirsin: key mi yok, yoksa value mu `null`?", "Çok thread'de bu iki çağrı arasında map değişebilir, bu yüzden cevap güvenilir olmaz. Bu karışıklık olmasın diye `ConcurrentHashMap` `null` key ve `null` value kabul etmez.", 'Solda `put(null, 1)` düğmesine bas.']],
        ['Resize: biraz erken ve birlikte', ["Burada 11 key var. Solda `k12` için put bas: table 12. key'de büyür. `HashMap` ise 13. key'de büyür.", "Taşıma sırasında taşınan bucket'a `ForwardingNode` konur. `get` onun üzerinden yeni table'a geçer, `put` yapan thread ise taşımaya yardım eder.", "Yer değiştiren Node'lar sağda işaretlenir. Node'lar bazen zincirde ters sıraya düşer, bu da JDK koduyla aynıdır."]],
        ['Atomic işlemler ve size', ["Her çağrı tek başına güvenlidir, ama `get`, sonra `put` birlikte atomic değildir: arada başka thread yazabilir.", 'Bunun için `merge`, `compute`, `computeIfAbsent` ve `putIfAbsent` vardır.', "`size()` yaklaşık da olabilir: sayaç `baseCount` ve `CounterCell`'lere bölünmüştür. Thread'ler yazarken sonuç kesin olmayabilir."]],
      ]},
    en: {title:'How ConcurrentHashMap works', door:'A HashMap for several threads. CAS on an empty bucket, a lock on a full one, resize and no nulls.',
      ui:{table:'Table', tableNull:'`table` is still null: it appears on the first put.', tryHint:'Type a key on the left and press put.', heldBy:n => `locked by Thread ${n}`, waiting:n => `${n} waiting`,
        t_init:() => 'The table was created on the first put: capacity 16, `sizeCtl` 12.', t_cas:() => 'The bucket was empty: the Node was written with CAS and no lock.', t_lock:() => 'The bucket was full: `synchronized` on its first Node.', t_replace:e => `The key existed: value is now ${e.val} and size is unchanged.`, t_append:() => 'The Node was added to the end of the chain.', t_presize:() => 'The chain reached 8 and capacity is below 64: the table grew.', t_tree:() => 'The chain reached 8: the bucket became a TreeBin. It is drawn as a list here.', t_resize:() => '`size` reached `sizeCtl`: the table doubled.', t_removed:() => 'The Node was removed.', t_none:() => 'No such key: the result is `null`.', t_nolock:() => '`get` takes no lock: the `val` and `next` fields of a Node are `volatile`.', t_found:e => `Found: ${e.val}.`,
        sameHash:'`"Aa"` and `"BB"` have the same hash, so they land in the same bucket.', sameHash2:'`"Aa"`, `"BB"` and `"C#"` share a hash (2112). `"Leyla"` lands in another bucket.',
        lockScope:'Where is the lock?', lockCol:'Lock', nullCol:'null key', lockNone:'none', lockAll:'one lock for the whole map', lockBin:'one bucket only', yes:'allowed', no:'NullPointerException',
        m0:'4 threads wrote 400,000 keys. `HashMap`: 232,091, 249,547, and once the threads were still running after 5 seconds. `ConcurrentHashMap`: 400,000 every time.', m3:'`put(null, 1)`, `put("x", null)` and `get(null)` all threw `NullPointerException`.', m4:'The `table` field was read through reflection on JDK 21. `ConcurrentHashMap` reached 32 on the 12th key and `HashMap` on the 13th. `new ConcurrentHashMap<>(16)` creates capacity 32.', m5:'2 threads incremented 1,000,000 times each. `get` + `put`: 1,052,031. `merge`: 2,000,000.',
        resizeRow:'Difference', resizeAt:'key that makes capacity 32', compound:'Single calls are safe, sequences are not', c1:'can lose updates', c2:'atomic'},
      ch:[
        ['Why is HashMap not enough?', ['`HashMap` is not thread-safe: threads writing at once can lose Nodes and break a resize.', '`Hashtable` puts every method behind one lock: threads wait for each other even when they use different buckets.', '`ConcurrentHashMap` narrows the lock to a bucket, so different buckets rarely get in each other\'s way. The Segment design of Java 7 was removed in Java 8.']],
        ['Empty bucket: CAS', ['If a bucket is empty, no lock is needed. The thread uses CAS: if it is `null`, write the Node.', 'If two threads write to the same empty bucket, one wins. The CAS of the other fails and its put starts over, and now the bucket is full.'],
          ['Two threads want to write to the same empty bucket.','Thread A did CAS: `"Aa"` was written with no lock.','The CAS of Thread B failed, because the bucket is no longer `null`. The thread does not stop: it checks again.','The bucket is full now: Thread B took a lock on the first Node.','Thread B wrote `"BB"` at the end of the chain and released the lock.']],
        ['Full bucket: lock', ['If the bucket is full, the thread takes `synchronized` on its first Node. The lock covers this bucket only.', 'A thread writing to the same bucket waits, and a thread writing to another bucket does not. This is the key difference from `Hashtable`.'],
          ['The bucket holds `"Aa"`.','Thread A took the lock to write `"BB"`.','Thread B wants to write `"C#"`: same bucket, so it waits.','Thread C wrote `"Leyla"`: another bucket, so it waited for nobody.','Thread A wrote `"BB"` and released the lock.','Thread B took the lock.','Thread B wrote `"C#"`. No Node was lost.']],
        ['Why no null?', ['In `HashMap`, when `get` returns `null` you can call `containsKey`: is the key missing, or is the value `null`?', 'With many threads the map can change between those two calls, so the answer cannot be trusted. To avoid this, `ConcurrentHashMap` rejects `null` keys and `null` values.', 'Press `put(null, 1)` on the left.']],
        ['Resize: a little earlier, and together', ['There are 11 keys here. Press put for `k12` on the left: the table grows on the 12th key. `HashMap` grows on the 13th.', 'During the move, a `ForwardingNode` goes into each moved bucket. `get` follows it to the new table, and a thread doing `put` helps with the move.', 'Nodes that moved are marked on the right. Nodes sometimes end up reversed in a chain, which matches the JDK code.']],
        ['Atomic operations and size', ['Each call is safe on its own, but `get` followed by `put` is not atomic: another thread can write in between.', 'That is what `merge`, `compute`, `computeIfAbsent` and `putIfAbsent` are for.', '`size()` can be approximate: the counter is split into `baseCount` and `CounterCell`s. While threads write, the result may not be exact.']],
      ]},
  },
};
