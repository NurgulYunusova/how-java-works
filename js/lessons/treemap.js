/* ---------- TreeMap: a port of put, deleteEntry and both fix-up methods from JDK 21 ---------- */
const RED = false, BLACK = true;
const tmColor = p => p ? p.c : BLACK, tmP = p => p ? p.p : null, tmL = p => p ? p.l : null, tmR = p => p ? p.r : null;
function tmSet(p, c) { if (p) p.c = c; }
function tmNew() { return {root:null, size:0, log:[]}; }
function tmSnap(t) { const f = n => n ? {k:n.k, c:n.c, l:f(n.l), r:f(n.r)} : null; return f(t.root); }
function tmNote(t, cap, ...hl) { t.log.push({tree:tmSnap(t), cap, hl:hl.filter(x => x !== null && x !== undefined)}); }
function tmRotL(t, p) {
  if (!p) return; const r = p.r; p.r = r.l; if (r.l) r.l.p = p; r.p = p.p;
  if (!p.p) t.root = r; else if (p.p.l === p) p.p.l = r; else p.p.r = r;
  r.l = p; p.p = r;
}
function tmRotR(t, p) {
  if (!p) return; const l = p.l; p.l = l.r; if (l.r) l.r.p = p; l.p = p.p;
  if (!p.p) t.root = l; else if (p.p.r === p) p.p.r = l; else p.p.l = l;
  l.r = p; p.p = l;
}
function tmPut(t, k) {
  t.log = [];
  if (!t.root) { t.root = {k, c:BLACK, l:null, r:null, p:null}; t.size = 1; tmNote(t, ['root', k], k); return; }
  let x = t.root, par;
  do { par = x; if (k === x.k) { tmNote(t, ['exists', k], x.k); return; } tmNote(t, [k < x.k ? 'goL' : 'goR', k, x.k], x.k); x = k < x.k ? x.l : x.r; } while (x);
  const e = {k, c:RED, l:null, r:null, p:par};
  if (k < par.k) par.l = e; else par.r = e;
  t.size++;
  tmNote(t, ['attach', k], k);
  let n = e;
  while (n && n !== t.root && n.p.c === RED) {
    if (tmP(n) === tmL(tmP(tmP(n)))) {
      const y = tmR(tmP(tmP(n)));
      if (tmColor(y) === RED) {
        tmSet(tmP(n), BLACK); tmSet(y, BLACK); tmSet(tmP(tmP(n)), RED);
        tmNote(t, ['recolor', tmP(tmP(n)).k], tmP(n).k, y.k, tmP(tmP(n)).k);
        n = tmP(tmP(n));
      } else {
        if (n === tmR(tmP(n))) { n = tmP(n); tmRotL(t, n); tmNote(t, ['rotL', n.k], n.k); }
        tmSet(tmP(n), BLACK); tmSet(tmP(tmP(n)), RED);
        const g = tmP(tmP(n)); tmRotR(t, g); tmNote(t, ['rotR', g.k], g.k);
      }
    } else {
      const y = tmL(tmP(tmP(n)));
      if (tmColor(y) === RED) {
        tmSet(tmP(n), BLACK); tmSet(y, BLACK); tmSet(tmP(tmP(n)), RED);
        tmNote(t, ['recolor', tmP(tmP(n)).k], tmP(n).k, y.k, tmP(tmP(n)).k);
        n = tmP(tmP(n));
      } else {
        if (n === tmL(tmP(n))) { n = tmP(n); tmRotR(t, n); tmNote(t, ['rotR', n.k], n.k); }
        tmSet(tmP(n), BLACK); tmSet(tmP(tmP(n)), RED);
        const g = tmP(tmP(n)); tmRotL(t, g); tmNote(t, ['rotL', g.k], g.k);
      }
    }
  }
  if (t.root.c !== BLACK) { t.root.c = BLACK; tmNote(t, ['rootBlack', t.root.k], t.root.k); }
  tmNote(t, ['doneP', k], k);
}
function tmSucc(n) { if (n.r) { let p = n.r; while (p.l) p = p.l; return p; } let p = n.p, c = n; while (p && c === p.r) { c = p; p = p.p; } return p; }
function tmFixDel(t, x) {
  while (x !== t.root && tmColor(x) === BLACK) {
    if (x === tmL(tmP(x))) {
      let s = tmR(tmP(x));
      if (tmColor(s) === RED) { tmSet(s, BLACK); tmSet(tmP(x), RED); tmRotL(t, tmP(x)); s = tmR(tmP(x)); tmNote(t, ['fixRot'], tmP(x).k); }
      if (tmColor(tmL(s)) === BLACK && tmColor(tmR(s)) === BLACK) { tmSet(s, RED); x = tmP(x); tmNote(t, ['fixUp'], s ? s.k : null); }
      else {
        if (tmColor(tmR(s)) === BLACK) { tmSet(tmL(s), BLACK); tmSet(s, RED); tmRotR(t, s); s = tmR(tmP(x)); }
        tmSet(s, tmColor(tmP(x))); tmSet(tmP(x), BLACK); tmSet(tmR(s), BLACK); tmRotL(t, tmP(x)); tmNote(t, ['fixRot'], s ? s.k : null); x = t.root;
      }
    } else {
      let s = tmL(tmP(x));
      if (tmColor(s) === RED) { tmSet(s, BLACK); tmSet(tmP(x), RED); tmRotR(t, tmP(x)); s = tmL(tmP(x)); tmNote(t, ['fixRot'], tmP(x).k); }
      if (tmColor(tmR(s)) === BLACK && tmColor(tmL(s)) === BLACK) { tmSet(s, RED); x = tmP(x); tmNote(t, ['fixUp'], s ? s.k : null); }
      else {
        if (tmColor(tmL(s)) === BLACK) { tmSet(tmR(s), BLACK); tmSet(s, RED); tmRotL(t, s); s = tmL(tmP(x)); }
        tmSet(s, tmColor(tmP(x))); tmSet(tmP(x), BLACK); tmSet(tmL(s), BLACK); tmRotR(t, tmP(x)); tmNote(t, ['fixRot'], s ? s.k : null); x = t.root;
      }
    }
  }
  tmSet(x, BLACK);
}
function tmDel(t, k) {
  t.log = [];
  let p = t.root; while (p && p.k !== k) p = k < p.k ? p.l : p.r;
  if (!p) { tmNote(t, ['noKey', k]); return false; }
  t.size--;
  if (p.l && p.r) { const s = tmSucc(p); tmNote(t, ['succ', k, s.k], k, s.k); p.k = s.k; p = s; }
  const rep = p.l || p.r;
  if (rep) {
    rep.p = p.p;
    if (!p.p) t.root = rep; else if (p === p.p.l) p.p.l = rep; else p.p.r = rep;
    p.l = p.r = p.p = null;
    tmNote(t, ['unlink', k]);
    if (p.c === BLACK) tmFixDel(t, rep);
  } else if (!p.p) { t.root = null; tmNote(t, ['unlink', k]); }
  else {
    if (p.c === BLACK) tmFixDel(t, p);
    if (p.p) { if (p === p.p.l) p.p.l = null; else if (p === p.p.r) p.p.r = null; p.p = null; }
    tmNote(t, ['unlink', k]);
  }
  tmNote(t, ['doneR', k]);
  return true;
}
function tmDump(n) { return n ? `${n.k}${n.c === RED ? 'R' : 'B'}(${tmDump(n.l)},${tmDump(n.r)})` : '.'; }
function tmRules(snap) {
  if (!snap) return {rootB:true, noRR:true, bh:0, same:true};
  let noRR = true, same = true, bh = null;
  const walk = (n, b) => {
    if (!n) { if (bh === null) bh = b; else if (bh !== b) same = false; return; }
    if (n.c === RED && ((n.l && n.l.c === RED) || (n.r && n.r.c === RED))) noRR = false;
    const nb2 = b + (n.c === BLACK ? 1 : 0);
    walk(n.l, nb2); walk(n.r, nb2);
  };
  walk(snap, 0);
  return {rootB:snap.c === BLACK, noRR, bh, same};
}
function tmSvg(snap, hl, path) {
  if (!snap) return `<p class="muted">${rich(lu('emptyTree'))}</p>`;
  let cnt = 0, maxD = 0; const pos = [], edges = [];
  const place = (n, d, par) => { if (!n) return; place(n.l, d + 1, n); n._x = cnt++; n._d = d; maxD = Math.max(maxD, d); pos.push(n); place(n.r, d + 1, n); };
  place(snap, 0, null);
  const X = n => 26 + n._x * 46, Y = n => 28 + n._d * 62;
  const link = n => { [n.l, n.r].forEach(c => { if (c) { edges.push(`<line class="tl" x1="${X(n)}" y1="${Y(n)}" x2="${X(c)}" y2="${Y(c)}"/>`); link(c); } }); };
  link(snap);
  const W = Math.max(200, 52 + (cnt - 1) * 46), H = 56 + maxD * 62;
  const nodes = pos.map(n => `<g class="tn${n.c === RED ? ' red' : ' black'}${hl.includes(n.k) ? ' on' : ''}"><circle cx="${X(n)}" cy="${Y(n)}" r="19"/><text x="${X(n)}" y="${Y(n) + 5}" text-anchor="middle">${n.k}</text></g>`).join('');
  return `<div class="tscroll"><svg class="tsvg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(tmDump(snap))}">${edges.join('')}${nodes}</svg></div>`;
}
const TM_INIT = {0:[50, 30, 70, 20, 40, 60, 80], 1:[50, 30, 70, 20, 40, 60, 80, 10], 2:[10, 5, 15], 3:[10, 5], 4:[50, 30, 70, 20, 40, 60, 80, 10], 5:[10, 20, 30, 40, 50]};
const TM_NEXT = {0:45, 1:25, 2:1, 3:1, 4:30, 5:35};
function tmBuild(keys) { const t = tmNew(); keys.forEach(k => tmPut(t, k)); return t; }
function tmSearch(t, k) {
  t.log = [];
  let n = t.root, steps = 0;
  while (n) { steps++; if (k === n.k) { tmNote(t, ['found', k, steps], n.k); return; } tmNote(t, [k < n.k ? 'goL' : 'goR', k, n.k], n.k); n = k < n.k ? n.l : n.r; }
  tmNote(t, ['noKey', k]);
}
function tmNav(t, kind, k) {
  let r = null;
  for (let n = t.root; n;) {
    if (kind === 'floorKey') { if (n.k <= k) { r = n.k; n = n.r; } else n = n.l; }
    else { if (n.k >= k) { r = n.k; n = n.l; } else n = n.r; }
  }
  return r;
}
LS.treemap = {
  init(i) { const t = tmBuild(TM_INIT[i]); t.log = []; return {t, keys:TM_INIT[i].slice(), i:0, key:String(TM_NEXT[i]), err:'', nav:null, code:TM_INIT[i].map(k => `m.put(${k}, "");`)}; },
  controls(st, ch) {
    return `<form class="tryit" data-submit="put" autocomplete="off"><h3>${esc(SITE[LANG].tryIt)}</h3><label class="stf"><span>Key (int)</span><input id="tm-key" name="key" type="text" inputmode="numeric" value="${esc(st.key)}"></label><div class="tr-acts"><button class="btn primary" type="submit">put</button><button class="btn" type="button" data-act="get">get</button><button class="btn" type="button" data-act="remove">remove</button>${ch === 5 ? '<button class="btn" type="button" data-act="floorKey">floorKey</button><button class="btn" type="button" data-act="ceilingKey">ceilingKey</button>' : ''}<button class="btn ghost" type="button" data-act="clear">${esc(SITE[LANG].clear)}</button></div><p class="tr-err" role="alert">${esc(st.err)}</p></form>` + lsStepper(st.i, st.t.log.length);
  },
  stage(st, ch) {
    const log = st.t.log, e = st.i ? log[st.i - 1] : null, snap = e ? e.tree : tmSnap(st.t), hl = e ? e.hl : [];
    const r = tmRules(snap), rule = (ok, txt) => `<li class="${ok ? 'ok' : 'bad'}"><span aria-hidden="true">${ok ? '✓' : '×'}</span> ${rich(txt)}</li>`;
    const inorder = []; const walk = n => { if (n) { walk(n.l); inorder.push(n.k); walk(n.r); } }; walk(snap);
    const cap = e ? ls$('c_' + e.cap[0], ...e.cap.slice(1)) : log.length ? lu('stepHint') : lu('startHint');
    let extra = '';
    if (ch === 5) extra = pnl(lu('trapsT'), `<pre class="logv">m.put(null, "x");                 // NullPointerException

TreeMap&lt;String, Integer&gt; c = new TreeMap&lt;&gt;(comparingInt(String::length));
c.put("Aysel", 1); c.put("Leyla", 2); c.put("Ali", 3);
System.out.println(c);             // {Ali=3, Aysel=2}</pre>` + measured(rich(lu('mTraps'))));
    return pnl('Red-black tree', tmSvg(snap, hl) + `<p class="explain-s">${rich(cap)}${st.nav ? ` <b class="navres">${esc(st.nav)}</b>` : ''}</p>`)
      + `<div class="pnl-row">${pnl(lu('rulesT'), `<ul class="rules">${rule(r.rootB, lu('r1'))}${rule(r.noRR, lu('r2'))}${rule(r.same, ls$('r3', r.bh))}</ul>`)}${pnl(lu('orderT'), `<p class="inord">${inorder.map(k => `<i class="val">${k}</i>`).join('') || '<span class="muted">{}</span>'}</p><p class="muted small">${rich(lu('orderNote'))}</p>`)}</div>` + extra
      + pnl('', measured(rich(lu('mTree'))));
  },
  act(st, a, v, ch) {
    if (a === 'next') { st.i = Math.min(st.t.log.length, st.i + 1); return; }
    if (a === 'prev') { st.i = Math.max(0, st.i - 1); return; }
    if (a === 'reset') { st.i = 0; return; }
    const raw = String(v instanceof FormData ? v.get('key') : $('tm-key').value).trim();
    st.key = raw; st.err = ''; st.nav = null;
    if (a === 'clear') { st.t = tmNew(); st.i = 0; return; }
    if (!/^-?\d{1,4}$/.test(raw)) { st.err = lu('badKey'); return; }
    const k = +raw;
    if (a === 'put') { if (st.t.size >= 24) { st.err = SITE[LANG].errMany; return; } tmPut(st.t, k); }
    if (a === 'get') tmSearch(st.t, k);
    if (a === 'remove') tmDel(st.t, k);
    if (a === 'floorKey' || a === 'ceilingKey') { const r = tmNav(st.t, a, k); st.t.log = []; st.nav = `${a}(${k}) = ${r === null ? 'null' : r}`; st.i = 0; return; }
    st.i = 1;
  },
  text: {
    az: {title:'TreeMap necə işləyir', door:'Red-black tree-ni canlı izlə: insert, recolor, rotation, remove və sıralı axtarış.',
      ui:{emptyTree:'Tree boşdur. Key yaz və put bas.', stepHint:'Növbəti ilə bu əməliyyatın addımlarını izlə.', startHint:'Solda key yaz və put bas. Sonra Növbəti ilə addımları izlə.', rulesT:'Red-black qaydaları', orderT:'Iteration sırası', orderNote:'Sıra in-order traversal-dır: həmişə artan.', trapsT:'Tələlər', badKey:'Tam ədəd yaz, məsələn 42.',
        r1:'Root qara rəngdədir', r2:'Qırmızı Node-un qırmızı child-ı yoxdur', r3:n => `Hər yolda eyni sayda qara Node var: ${n}`,
        mTree:'Təsadüfi put və remove ardıcıllıqları JDK 21 `TreeMap`-ində reflection ilə yoxlanılıb: key, rəng və quruluş eynidir.', mTraps:'Hər iki nəticə JDK 21-də yoxlanılıb. `Comparable` olmayan key isə `ClassCastException` verir.',
        c_root:k => `Tree boş idi: ${k} root oldu və root həmişə qaradır.`, c_exists:k => `${k} artıq var: yalnız value dəyişir, tree dəyişmir.`, c_goL:(k, x) => `${k} < ${x}: sola gedir.`, c_goR:(k, x) => `${k} > ${x}: sağa gedir.`, c_attach:k => `${k} qırmızı Node kimi əlavə olundu. Yeni Node həmişə qırmızıdır.`, c_recolor:k => `Valideyn və əmi qırmızıdır: ikisi qara, ${k} qırmızı olur. Yoxlama yuxarı keçir.`, c_rotL:k => `${k} ətrafında sola rotation.`, c_rotR:k => `${k} ətrafında sağa rotation.`, c_rootBlack:() => 'Root yenidən qara edildi.', c_doneP:k => `${k} yerləşdi, qaydalar pozulmur.`, c_found:(k, n) => `Tapıldı: ${n} müqayisə ilə.`, c_noKey:k => `${k} yoxdur.`, c_succ:(k, s) => `${k}-in iki child-ı var: yerinə növbəti key (${s}) yazılır, ${s}-in köhnə Node-u silinir.`, c_unlink:k => `Node tree-dən çıxarıldı.`, c_fixRot:() => 'Qara Node silindiyi üçün balans pozuldu: rotation və yenidən rəngləmə.', c_fixUp:() => 'Qardaş qırmızı oldu, problem bir səviyyə yuxarı keçdi.', c_doneR:k => `${k} silindi, qaydalar yenidən qorunur.`},
      ch:[
        ['Sıralı tree', ['`HashMap` sıra saxlamır, `TreeMap` isə key-ləri həmişə sıralı saxlayır. Hər Node üçün: solda kiçiklər, sağda böyüklər.', 'Axtarış hər addımda yarısını atır: `O(log n)`. 1 milyon key üçün təxminən 20 müqayisə.', 'Solda `get` bas və yola bax.']],
        ['Red-black qaydaları', ['Key-lər sıra ilə gəlsə, adi tree bir list-ə çevrilər və `O(n)` olar. Red-black tree rənglərlə balansı qoruyur.', 'Sağda üç qayda canlı yoxlanır. Onlar ən uzun yolun ən qısa yoldan 2 dəfədən çox uzun olmamasını təmin edir.', 'Başqa key-lər əlavə et: qaydalar heç pozulmur.']],
        ['Insert: recolor', ['Yeni Node qırmızı gəlir, çünki qara sayını dəyişmir. Valideyni də qırmızıdırsa, düzəliş lazımdır.', 'Əmi də qırmızıdırsa, ən ucuz düzəliş rəngləri dəyişməkdir: valideyn və əmi qara, baba qırmızı olur.', 'Solda `1` üçün put bas və addımla.']],
        ['Insert: rotation', ['Əmi qaradırsa, rəng kifayət etmir. Rotation Node-ları yerini dəyişir, amma sıranı pozmur.', 'Burada 10, 5 var. `1` üçün put bas: sağa rotation. Sonra `Təmizlə` bas, 10, 5, 7 yaz: əvvəl sola, sonra sağa rotation.', 'Bir insert ən çox 2 rotation edir.']],
        ['Remove', ['İki child-ı olan Node birbaşa silinmir: yerinə növbəti key yazılır, köhnə Node isə silinir.', 'Silinən Node qırmızıdırsa, qaydalar pozulmur. Qaradırsa, `fixAfterDeletion` rotation və rənglə balansı bərpa edir.', 'Solda `30` üçün remove bas.']],
        ['Naviqasiya və tələlər', ['Sıra sayəsində `HashMap`-in edə bilmədiyi sorğular var: `floorKey`, `ceilingKey`, `headMap`, `tailMap`, `firstKey`.', '`null` key olmaz, çünki müqayisə olunmalıdır.', 'Ən gizli tələ: `TreeMap` üçün eynilik `compareTo == 0` deməkdir, `equals` yox. Uzunluğa görə Comparator-da `"Leyla"` `"Aysel"`-in value-sunu əvəz edir.']],
      ]},
    tr: {title:'TreeMap nasıl çalışır', door:"Red-black tree'yi canlı izle: insert, recolor, rotation, remove ve sıralı arama.",
      ui:{emptyTree:'Tree boş. Key yaz ve put bas.', stepHint:'Sonraki ile bu işlemin adımlarını izle.', startHint:'Solda key yaz ve put bas. Sonra Sonraki ile adımları izle.', rulesT:'Red-black kuralları', orderT:'Iteration sırası', orderNote:'Sıra in-order traversal\'dır: her zaman artan.', trapsT:'Tuzaklar', badKey:'Tam sayı yaz, örneğin 42.',
        r1:'Root siyahtır', r2:"Kırmızı Node'un kırmızı child'ı yok", r3:n => `Her yolda aynı sayıda siyah Node var: ${n}`,
        mTree:"Rastgele put ve remove dizileri JDK 21 `TreeMap`'inde reflection ile kontrol edildi: key, renk ve yapı aynı.", mTraps:"İki sonuç da JDK 21'de kontrol edildi. `Comparable` olmayan key ise `ClassCastException` verir.",
        c_root:k => `Tree boştu: ${k} root oldu ve root her zaman siyahtır.`, c_exists:k => `${k} zaten var: yalnızca value değişir, tree değişmez.`, c_goL:(k, x) => `${k} < ${x}: sola gider.`, c_goR:(k, x) => `${k} > ${x}: sağa gider.`, c_attach:k => `${k} kırmızı Node olarak eklendi. Yeni Node her zaman kırmızıdır.`, c_recolor:k => `Ebeveyn ve amca kırmızı: ikisi siyah, ${k} kırmızı olur. Kontrol yukarı geçer.`, c_rotL:k => `${k} çevresinde sola rotation.`, c_rotR:k => `${k} çevresinde sağa rotation.`, c_rootBlack:() => 'Root yeniden siyah yapıldı.', c_doneP:k => `${k} yerleşti, kurallar bozulmuyor.`, c_found:(k, n) => `Bulundu: ${n} karşılaştırma ile.`, c_noKey:k => `${k} yok.`, c_succ:(k, s) => `${k} için iki child var: yerine sıradaki key (${s}) yazılır, ${s} için eski Node silinir.`, c_unlink:() => "Node tree'den çıkarıldı.", c_fixRot:() => 'Siyah Node silindiği için denge bozuldu: rotation ve yeniden renklendirme.', c_fixUp:() => 'Kardeş kırmızı oldu, sorun bir seviye yukarı geçti.', c_doneR:k => `${k} silindi, kurallar yeniden korunuyor.`},
      ch:[
        ['Sıralı tree', ["`HashMap` sıra tutmaz, `TreeMap` ise key'leri her zaman sıralı tutar. Her Node için: solda küçükler, sağda büyükler.", 'Arama her adımda yarısını atar: `O(log n)`. 1 milyon key için yaklaşık 20 karşılaştırma.', 'Solda `get` bas ve yola bak.']],
        ['Red-black kuralları', ["Key'ler sırayla gelirse normal tree list'e döner ve `O(n)` olur. Red-black tree renklerle dengeyi korur.", 'Sağda üç kural canlı kontrol edilir. En uzun yolun en kısa yolun 2 katından uzun olmamasını sağlarlar.', "Başka key'ler ekle: kurallar hiç bozulmaz."]],
        ['Insert: recolor', ["Yeni Node kırmızı gelir, çünkü siyah sayısını değiştirmez. Ebeveyni de kırmızıysa düzeltme gerekir.", 'Amca da kırmızıysa en ucuz düzeltme renkleri değiştirmektir: ebeveyn ve amca siyah, dede kırmızı olur.', 'Solda `1` için put bas ve adımla.']],
        ['Insert: rotation', ["Amca siyahsa renk yetmez. Rotation Node'ların yerini değiştirir, ama sırayı bozmaz.", "Burada 10, 5 var. `1` için put bas: sağa rotation. Sonra `Temizle` bas, 10, 5, 7 yaz: önce sola, sonra sağa rotation.", 'Bir insert en fazla 2 rotation yapar.']],
        ['Remove', ["İki child'ı olan Node doğrudan silinmez: yerine sıradaki key yazılır, eski Node silinir.", 'Silinen Node kırmızıysa kurallar bozulmaz. Siyahsa `fixAfterDeletion` rotation ve renkle dengeyi geri getirir.', 'Solda `30` için remove bas.']],
        ['Navigasyon ve tuzaklar', ["Sıra sayesinde `HashMap`'in yapamadığı sorgular vardır: `floorKey`, `ceilingKey`, `headMap`, `tailMap`, `firstKey`.", '`null` key olmaz, çünkü karşılaştırılması gerekir.', 'En gizli tuzak: `TreeMap` için aynılık `compareTo == 0` demektir, `equals` değil. Uzunluğa göre Comparator ile `"Leyla"`, `"Aysel"` value\'sunu değiştirir.']],
      ]},
    en: {title:'How TreeMap works', door:'Watch a red-black tree live: insert, recolor, rotation, remove and ordered search.',
      ui:{emptyTree:'The tree is empty. Type a key and press put.', stepHint:'Use Next to follow the steps of this operation.', startHint:'Type a key on the left and press put. Then use Next to follow the steps.', rulesT:'Red-black rules', orderT:'Iteration order', orderNote:'The order is an in-order traversal: always ascending.', trapsT:'Traps', badKey:'Type a whole number, for example 42.',
        r1:'The root is black', r2:'A red Node has no red child', r3:n => `Every path has the same number of black Nodes: ${n}`,
        mTree:'Random put and remove sequences were checked against JDK 21 `TreeMap` with reflection: keys, colors and shape match.', mTraps:'Both results were checked on JDK 21. A key that is not `Comparable` throws `ClassCastException`.',
        c_root:k => `The tree was empty: ${k} became the root, and the root is always black.`, c_exists:k => `${k} already exists: only the value changes, not the tree.`, c_goL:(k, x) => `${k} < ${x}: go left.`, c_goR:(k, x) => `${k} > ${x}: go right.`, c_attach:k => `${k} was added as a red Node. A new Node is always red.`, c_recolor:k => `The parent and uncle are red: both turn black and ${k} turns red. The check moves up.`, c_rotL:k => `Rotate left around ${k}.`, c_rotR:k => `Rotate right around ${k}.`, c_rootBlack:() => 'The root was made black again.', c_doneP:k => `${k} is in place and no rule is broken.`, c_found:(k, n) => `Found after ${n} comparison${n === 1 ? '' : 's'}.`, c_noKey:k => `${k} is not there.`, c_succ:(k, s) => `${k} has two children: the next key (${s}) is written in its place and the old Node of ${s} is removed.`, c_unlink:() => 'The Node left the tree.', c_fixRot:() => 'A black Node was removed, which broke the balance: rotation and recoloring.', c_fixUp:() => 'The sibling turned red and the problem moved up a level.', c_doneR:k => `${k} was removed and the rules hold again.`},
      ch:[
        ['An ordered tree', ['`HashMap` keeps no order, while `TreeMap` always keeps keys sorted. For each Node: smaller on the left, larger on the right.', 'Each search step discards half: `O(log n)`. About 20 comparisons for 1 million keys.', 'Press `get` on the left and watch the path.']],
        ['The red-black rules', ['If keys arrive in order, a plain tree turns into a list and becomes `O(n)`. A red-black tree keeps balance with colors.', 'The three rules on the right are checked live. They ensure the longest path is at most twice the shortest.', 'Add other keys: the rules never break.']],
        ['Insert: recolor', ['A new Node starts red, because that does not change the black count. If its parent is also red, a fix is needed.', 'If the uncle is red too, the cheapest fix is recoloring: parent and uncle turn black, grandparent turns red.', 'Press put for `1` on the left and step through.']],
        ['Insert: rotation', ['If the uncle is black, colors are not enough. A rotation moves Nodes without breaking the order.', 'Here we have 10, 5. Press put for `1`: a right rotation. Then press `Clear` and enter 10, 5, 7: a left, then a right rotation.', 'One insert makes at most 2 rotations.']],
        ['Remove', ['A Node with two children is not removed directly: the next key is written in its place and the old Node goes.', 'If the removed Node is red, no rule breaks. If it is black, `fixAfterDeletion` restores balance with rotation and color.', 'Press remove for `30` on the left.']],
        ['Navigation and traps', ['Order allows queries that `HashMap` cannot do: `floorKey`, `ceilingKey`, `headMap`, `tailMap`, `firstKey`.', 'A `null` key is not allowed, because it must be compared.', 'The most hidden trap: for `TreeMap`, same means `compareTo == 0`, not `equals`. With a length Comparator, `"Leyla"` replaces the value of `"Aysel"`.']],
      ]},
  },
};
