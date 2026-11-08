/* ---------- Stream: the same Sink chain the JDK builds ---------- */
const ST_OPS = {
  even:{java:'filter(x -> x % 2 == 0)', k:'filter', f:x => x % 2 === 0},
  gt2:{java:'filter(x -> x > 2)', k:'filter', f:x => x > 2},
  x10:{java:'map(x -> x * 10)', k:'map', f:x => x * 10},
  p1:{java:'map(x -> x + 1)', k:'map', f:x => x + 1},
  sorted:{java:'sorted()', k:'sorted'},
  distinct:{java:'distinct()', k:'distinct'},
  limit2:{java:'limit(2)', k:'limit', n:2},
  skip1:{java:'skip(1)', k:'skip', n:1},
};
const ST_TERM = {none:'', toList:'.toList()', count:'.count()', findFirst:'.findFirst()', anyMatch:'.anyMatch(x -> x > 3)'};
function strRun(list, ops, term) {
  const ev = [];
  if (term === 'none') return {ev, lazy:true, result:null};
  let sortedF = false, sized = true;
  const noop = ops.map(o => {
    const d = ST_OPS[o];
    if (d.k === 'sorted') { const was = sortedF; sortedF = true; return was; }
    if (d.k === 'map') sortedF = false;
    if (d.k === 'filter' || d.k === 'distinct') sized = false;
    return false;
  });
  if (term === 'count' && sized) {
    let n = list.length;
    ops.forEach(o => { const d = ST_OPS[o]; if (d.k === 'limit') n = Math.min(n, d.n); if (d.k === 'skip') n = Math.max(0, n - d.n); });
    return {ev, elided:true, result:String(n)};
  }
  const collected = [];
  let found = false, res = null, count = 0;
  const N = ops.length;
  const termSink = {begin() {}, end() {}, cancel:() => found, accept(v) {
    if (term === 'toList') { collected.push(v); ev.push({at:N, v, r:'take'}); }
    else if (term === 'count') { count++; ev.push({at:N, v, r:'take'}); }
    else if (term === 'findFirst') { if (!found) { found = true; res = v; ev.push({at:N, v, r:'take'}); } }
    else if (term === 'anyMatch') { if (!found) { const ok = v > 3; ev.push({at:N, v, r:ok ? 'take' : 'drop'}); if (ok) found = true; } }
  }};
  let sink = termSink;
  for (let i = N - 1; i >= 0; i--) {
    const d = ST_OPS[ops[i]], down = sink;
    if (noop[i]) { sink = {begin:() => down.begin(), end:() => down.end(), cancel:() => down.cancel(), accept(v) { ev.push({at:i, v, r:'pass', out:v}); down.accept(v); }}; continue; }
    if (d.k === 'filter') sink = {begin:() => down.begin(), end:() => down.end(), cancel:() => down.cancel(), accept(v) { const ok = d.f(v); ev.push({at:i, v, r:ok ? 'pass' : 'drop', out:v}); if (ok) down.accept(v); }};
    else if (d.k === 'map') sink = {begin:() => down.begin(), end:() => down.end(), cancel:() => down.cancel(), accept(v) { const o = d.f(v); ev.push({at:i, v, r:'pass', out:o}); down.accept(o); }};
    else if (d.k === 'distinct') { const seen = new Set(); sink = {begin:() => down.begin(), end:() => down.end(), cancel:() => down.cancel(), accept(v) { const fresh = !seen.has(v); seen.add(v); ev.push({at:i, v, r:fresh ? 'pass' : 'drop', out:v}); if (fresh) down.accept(v); }}; }
    else if (d.k === 'limit') { let m = d.n; sink = {begin:() => down.begin(), end:() => down.end(), cancel:() => m === 0 || down.cancel(), accept(v) { if (m > 0) { m--; ev.push({at:i, v, r:'pass', out:v}); down.accept(v); } else ev.push({at:i, v, r:'drop', out:v}); }}; }
    else if (d.k === 'skip') { let m = d.n; sink = {begin:() => down.begin(), end:() => down.end(), cancel:() => down.cancel(), accept(v) { if (m === 0) { ev.push({at:i, v, r:'pass', out:v}); down.accept(v); } else { m--; ev.push({at:i, v, r:'drop', out:v}); } }}; }
    else if (d.k === 'sorted') {
      const buf = [];
      sink = {begin:() => {}, cancel:() => false, accept(v) { buf.push(v); ev.push({at:i, v, r:'hold', out:v}); },
        end() { buf.sort((a, b) => a - b); ev.push({at:i, r:'flush', list:buf.slice()}); down.begin(); for (const v of buf) { if (down.cancel()) break; down.accept(v); } down.end(); }};
    }
  }
  sink.begin();
  for (const v of list) { if (sink.cancel()) break; ev.push({at:-1, v, r:'emit', out:v}); sink.accept(v); }
  sink.end();
  const result = term === 'toList' ? '[' + collected.join(', ') + ']' : term === 'count' ? String(count) : term === 'findFirst' ? (res === null ? 'Optional.empty' : `Optional[${res}]`) : String(found);
  return {ev, result};
}
const ST_PRE = {
  0:{list:[1, 2, 3, 4], ops:['even', 'x10'], term:'none'},
  1:{list:[1, 2, 3, 4], ops:['even', 'x10'], term:'toList'},
  2:{list:[1, 2, 3, 4, 5, 6], ops:['even', 'x10'], term:'findFirst'},
  3:{list:[3, 1, 2], ops:['p1', 'sorted', 'limit2'], term:'toList'},
  4:{list:[1, 2, 3], ops:['x10'], term:'count'},
};
function stCode(st) {
  return `List.of(${st.list.join(', ')}).stream()\n` + st.ops.map(o => '    .' + ST_OPS[o].java).join('\n') + (st.ops.length ? '\n' : '') + (ST_TERM[st.term] ? '    ' + ST_TERM[st.term] + ';' : '    ;');
}
function stColumns(st, r, upto) {
  const cols = [{name:`List.of(...)`, items:st.list.map(v => ({v, s:'wait'}))}];
  st.ops.forEach(o => cols.push({name:ST_OPS[o].java, items:[]}));
  if (st.term !== 'none') cols.push({name:ST_TERM[st.term].slice(1), items:[]});
  let emitted = 0;
  for (let i = 0; i < upto; i++) {
    const e = r.ev[i], cur = i === upto - 1;
    if (e.at === -1) { const it = cols[0].items[emitted++]; it.s = 'sent'; it.cur = cur; continue; }
    const col = cols[e.at + 1];
    if (e.r === 'flush') { col.items.forEach(x => { if (x.s === 'hold') x.s = 'released'; }); col.flush = e.list; col.cur = cur; continue; }
    col.items.push({v:e.v, out:e.out, s:e.r, cur});
  }
  return `<div class="stcols">${cols.map(c => `<div class="stcol${c.cur ? ' cur' : ''}"><h3><code class="bare">${esc(c.name)}</code></h3><div class="stitems">${c.items.map(x => `<span class="sti s-${x.s}${x.cur ? ' cur' : ''}">${x.v}${x.out !== undefined && x.out !== x.v ? ` <small>→ ${x.out}</small>` : ''}</span>`).join('')}</div>${c.flush ? `<p class="muted small">sorted: ${esc(c.flush.join(', '))}</p>` : ''}</div>`).join('')}</div>`;
}
function stCaption(st, r, i) {
  if (r.lazy) return lu('lazy');
  if (r.elided) return lu('elided');
  if (i === 0) return lu('pressNext');
  const e = r.ev[i - 1], name = e.at >= 0 && e.at < st.ops.length ? ST_OPS[st.ops[e.at]].k : 'term';
  return ls$('e_' + e.r, e.v, e.out, name, e.list);
}
LS.stream = {
  init(i) { if (ST_PRE[i]) { const p = ST_PRE[i]; return {i:0, list:p.list.slice(), ops:p.ops.slice(), term:p.term, err:'', input:p.list.join(', ')}; } return {}; },
  controls(st, ch) {
    if (!ST_PRE[ch]) return '';
    const r = strRun(st.list, st.ops, st.term);
    const chips = st.ops.map((o, j) => `<button class="opchip" type="button" data-act="rm" data-v="${j}" title="${esc(lu('remove'))}"><code class="bare">${esc(ST_OPS[o].java)}</code><span aria-hidden="true">×</span></button>`).join('');
    const addOpts = Object.entries(ST_OPS).map(([k, d]) => `<option value="${k}">${esc(d.java)}</option>`).join('');
    const termOpts = Object.keys(ST_TERM).map(k => `<option value="${k}"${st.term === k ? ' selected' : ''}>${esc(ST_TERM[k] ? ST_TERM[k].slice(1) : lu('noTerm'))}</option>`).join('');
    return `<form class="tryit" data-submit="list" autocomplete="off"><h3>${esc(SITE[LANG].tryIt)}</h3><label class="stf"><span>${esc(lu('listL'))}</span><span class="stf-row"><input id="st-list" name="list" type="text" value="${esc(st.input)}" spellcheck="false"><button class="btn" type="submit">OK</button></span></label><p class="tr-err" role="alert">${esc(st.err)}</p><div class="opchips">${chips || `<span class="muted small">${esc(lu('noOps'))}</span>`}</div><label class="stf"><span>${esc(lu('addL'))}</span><select id="st-add" data-change="add"><option value="">${esc(lu('choose'))}</option>${addOpts}</select></label><label class="stf"><span>${esc(lu('termL'))}</span><select id="st-term" data-change="term">${termOpts}</select></label></form>` + lsStepper(st.i, r.ev.length);
  },
  stage(st, ch) {
    if (!ST_PRE[ch]) {
      return pnl(lu('lambdaT'), `<pre class="logv">int base = 10;
Runnable a = () -> System.out.println(base);   // ${esc(lu('capt'))}
Runnable b = () -> System.out.println(base);
a == b;                                         // false

Stream&lt;Integer&gt; s = list.stream();
s.toList();
s.toList();   // IllegalStateException</pre>`)
        + pnl('', measured(rich(lu('mLambda'))));
    }
    const r = strRun(st.list, st.ops, st.term);
    const done = st.i >= r.ev.length;
    return pnl(LS_UI[LANG].code, `<pre class="logv">${esc(stCode(st))}</pre>`)
      + pnl(lu('flow'), stColumns(st, r, st.i) + `<p class="explain-s">${rich(stCaption(st, r, st.i))}</p>${r.result !== null && done ? `<p class="verdict ok">${rich(ls$('res', r.result))}</p>` : ''}`)
      + pnl('', measured(rich(lu('mFlow'))));
  },
  act(st, a, v, ch) {
    if (!ST_PRE[ch]) return;
    const n = strRun(st.list, st.ops, st.term).ev.length;
    if (a === 'next') st.i = Math.min(n, st.i + 1);
    if (a === 'prev') st.i = Math.max(0, st.i - 1);
    if (a === 'reset') st.i = 0;
    if (a === 'rm') { st.ops.splice(+v, 1); st.i = 0; }
    if (a === 'add' && v) { if (st.ops.length < 6) st.ops.push(v); st.i = 0; }
    if (a === 'term') { st.term = v; st.i = 0; }
    if (a === 'list') {
      const raw = String(v.get('list')); st.input = raw;
      const parts = raw.split(',').map(x => x.trim()).filter(Boolean);
      if (!parts.length || parts.length > 8 || parts.some(x => !/^-?\d{1,3}$/.test(x))) { st.err = lu('badList'); return; }
      st.err = ''; st.list = parts.map(Number); st.i = 0;
    }
  },
  text: {
    az: {title:'Stream necə işləyir', door:'Stream lazy-dir. Element-lər bir-bir keçir, sorted hamısını saxlayır, count bəzən heç nə işlətmir.',
      ui:{flow:'Element-lərin yolu', pressNext:'Növbəti düyməsini bas: növbəti element hərəkət edəcək.', lazy:'Terminal operation yoxdur, ona görə heç bir lambda işləmədi. Terminal əlavə et.', elided:'Heç bir lambda işləmədi: JDK ölçünü bilir, element-ləri gəzmədən cavab verdi.', res:v => `Nəticə: \`${v}\``,
        e_emit:v => `Source növbəti element-i verir: ${v}.`, e_pass:(v, o, k) => k === 'map' ? `\`map\`: ${v} → ${o}, davam edir.` : `\`${k}\`: ${v} keçir.`, e_drop:(v, o, k) => k === 'term' ? `Şərtə uyğun deyil: ${v}.` : `\`${k}\`: ${v} dayanır, növbəti əməliyyatlar onu görmür.`, e_hold:v => `\`sorted\`: ${v} buferdə qalır, hələ irəli getmir.`, e_flush:(v, o, k, l) => `Source bitdi. \`sorted\` sıraladı: ${l.join(', ')}. İndi irəli buraxır.`, e_take:v => `Terminal ${v} aldı.`,
        remove:'Sil', noOps:'Intermediate əməliyyat yoxdur.', listL:'List (vergüllə)', addL:'Əməliyyat əlavə et', choose:'Seç...', termL:'Terminal', noTerm:'yoxdur', badList:'1-8 tam ədəd yaz, məsələn 3, 1, 2.',
        mFlow:'Hər kombinasiya JDK 21-də hər əməliyyatın qarşısına `peek` qoyularaq yoxlanılıb: sıra eynidir.', lambdaT:'Lambda və stream obyektləri', capt:'base capture olunur',
        mLambda:'`a == b` `false` oldu. Loop içində capture etməyən lambda hər dəfə eyni object idi, capture edən isə hər dəfə yeni object. Eyni stream-i ikinci dəfə işlətmək `IllegalStateException` verdi.'},
      ch:[
        ['Stream lazy-dir', ['`filter` və `map` işi görmür, yalnız pipeline-ı qurur. Terminal operation olmadan heç bir lambda işləmir.', 'Solda terminal seç: `toList` və ya başqa biri. Bundan sonra Növbəti düyməsi işləyəcək.']],
        ['Element-lər bir-bir keçir', ['Çox adam elə bilir ki, əvvəl bütün element-lər `filter`-dən, sonra hamısı `map`-dən keçir. Belə deyil.', 'Hər element bütün pipeline-ı keçir, sonra növbəti element başlayır. Buna görə lazımsız iş azalır.', 'Solda list-i və əməliyyatları dəyiş: nəticə canlı hesablanır.']],
        ['Short-circuit', ['`findFirst`, `anyMatch` və `limit` işi tez bitirə bilər. Nəticə tapılanda qalan element-lər ümumiyyətlə oxunmur.', 'Burada 6 element var, amma yalnız 2-si işlənir. Bu, sonsuz stream-lərin də işləməsinə imkan verir: `Stream.iterate(...).limit(5)`.']],
        ['sorted hamısını saxlayır', ['`sorted` stateful əməliyyatdır: sıralamaq üçün bütün element-ləri görməlidir. Ona görə element-lər onun qarşısında toplanır.', 'Sonrakı `limit(2)` işi azaltmır, source-dan hər şey oxunur. Mümkünsə `filter`-i `sorted`-dən əvvəl yaz.', '`distinct` də bütün gördüyü dəyərləri yadda saxlayır, amma element-ləri dərhal buraxır.']],
        ['count bəzən heç nə işlətmir', ['Burada `map` lambda-sı bir dəfə də işləmir. JDK 9-dan bəri ölçü məlumdursa, `count` element-ləri gəzmir.', '`filter` əlavə et: ölçü artıq məlum deyil və lambda işləyir. Solda sına.', 'Tələ: `peek` və ya `map`-də yan təsirə güvənmə, işləməyə bilər.']],
        ['Lambda obyektdir', ['Lambda bir functional interface object-idir. Capture etdiyi dəyərlər object-in içinə kopyalanır, ona görə local variable effectively final olmalıdır.', 'Capture etməyən lambda adətən eyni object olaraq qalır, capture edən isə hər dəfə yenisini yarada bilər.', 'Stream bir dəfəlikdir: terminal-dan sonra yenidən işlətmək olmaz.']],
      ]},
    tr: {title:'Stream nasıl çalışır', door:"Stream lazy'dir. Element'ler tek tek geçer, sorted hepsini tutar, count bazen hiçbir şey çalıştırmaz.",
      ui:{flow:"Element'lerin yolu", pressNext:'Sonraki düğmesine bas: sıradaki element hareket edecek.', lazy:'Terminal operation yok, bu yüzden hiçbir lambda çalışmadı. Terminal ekle.', elided:"Hiçbir lambda çalışmadı: JDK boyutu biliyor, element'leri gezmeden cevap verdi.", res:v => `Sonuç: \`${v}\``,
        e_emit:v => `Source sıradaki element'i verir: ${v}.`, e_pass:(v, o, k) => k === 'map' ? `\`map\`: ${v} → ${o}, devam ediyor.` : `\`${k}\`: ${v} geçiyor.`, e_drop:(v, o, k) => k === 'term' ? `Koşula uymuyor: ${v}.` : `\`${k}\`: ${v} duruyor, sonraki işlemler onu görmez.`, e_hold:v => `\`sorted\`: ${v} buffer'da kalıyor, henüz ilerlemiyor.`, e_flush:(v, o, k, l) => `Source bitti. \`sorted\` sıraladı: ${l.join(', ')}. Şimdi ileri bırakıyor.`, e_take:v => `Terminal ${v} aldı.`,
        remove:'Sil', noOps:'Intermediate işlem yok.', listL:'List (virgülle)', addL:'İşlem ekle', choose:'Seç...', termL:'Terminal', noTerm:'yok', badList:'1-8 tam sayı yaz, örneğin 3, 1, 2.',
        mFlow:"Her kombinasyon JDK 21'de her işlemin önüne `peek` konarak kontrol edildi: sıra aynı.", lambdaT:'Lambda ve stream nesneleri', capt:'base capture edilir',
        mLambda:"`a == b` `false` çıktı. Loop içinde capture etmeyen lambda her seferinde aynı object'ti, capture eden ise her seferinde yeni object. Aynı stream'i ikinci kez kullanmak `IllegalStateException` verdi."},
      ch:[
        ["Stream lazy'dir", ["`filter` ve `map` işi yapmaz, yalnızca pipeline'ı kurar. Terminal operation olmadan hiçbir lambda çalışmaz.", 'Solda terminal seç: `toList` veya başka biri. Bundan sonra Sonraki düğmesi çalışır.']],
        ["Element'ler tek tek geçer", ["Birçok kişi önce tüm element'lerin `filter`'dan, sonra hepsinin `map`'ten geçtiğini sanır. Öyle değil.", "Her element tüm pipeline'ı geçer, sonra sıradaki element başlar. Bu yüzden gereksiz iş azalır.", "Solda list'i ve işlemleri değiştir: sonuç canlı hesaplanır."]],
        ['Short-circuit', ["`findFirst`, `anyMatch` ve `limit` işi erken bitirebilir. Sonuç bulununca kalan element'ler hiç okunmaz.", "Burada 6 element var, ama yalnızca 2'si işlenir. Bu, sonsuz stream'lerin de çalışmasını sağlar: `Stream.iterate(...).limit(5)`."]],
        ['sorted hepsini tutar', ["`sorted` stateful işlemdir: sıralamak için tüm element'leri görmelidir. Bu yüzden element'ler önünde birikir.", "Sonraki `limit(2)` işi azaltmaz, source'tan her şey okunur. Mümkünse `filter`'ı `sorted`'dan önce yaz.", "`distinct` de gördüğü tüm değerleri hatırlar, ama element'leri hemen bırakır."]],
        ['count bazen hiçbir şey çalıştırmaz', ["Burada `map` lambda'sı bir kez bile çalışmaz. JDK 9'dan beri boyut biliniyorsa `count`, element'leri gezmez.", "`filter` ekle: boyut artık bilinmez ve lambda çalışır. Solda dene.", "Tuzak: `peek` veya `map` içindeki yan etkiye güvenme, çalışmayabilir."]],
        ['Lambda bir object\'tir', ["Lambda bir functional interface object'idir. Capture ettiği değerler object'in içine kopyalanır, bu yüzden local variable effectively final olmalıdır.", "Capture etmeyen lambda genellikle aynı object olarak kalır, capture eden ise her seferinde yenisini oluşturabilir.", "Stream tek kullanımlıktır: terminal'den sonra yeniden kullanılamaz."]],
      ]},
    en: {title:'How Stream works', door:'Streams are lazy. Elements pass one by one, sorted holds them all, and count sometimes runs nothing.',
      ui:{flow:'The path of the elements', pressNext:'Press Next: the next element moves.', lazy:'There is no terminal operation, so no lambda ran. Add a terminal.', elided:'No lambda ran: the JDK knows the size and answered without visiting the elements.', res:v => `Result: \`${v}\``,
        e_emit:v => `The source gives the next element: ${v}.`, e_pass:(v, o, k) => k === 'map' ? `\`map\`: ${v} → ${o}, and it goes on.` : `\`${k}\`: ${v} passes.`, e_drop:(v, o, k) => k === 'term' ? `Does not match: ${v}.` : `\`${k}\`: ${v} stops, and later operations never see it.`, e_hold:v => `\`sorted\`: ${v} stays in the buffer and does not move on yet.`, e_flush:(v, o, k, l) => `The source is finished. \`sorted\` ordered them: ${l.join(', ')}. Now it lets them through.`, e_take:v => `The terminal took ${v}.`,
        remove:'Remove', noOps:'No intermediate operations.', listL:'List (comma separated)', addL:'Add an operation', choose:'Choose...', termL:'Terminal', noTerm:'none', badList:'Type 1 to 8 whole numbers, for example 3, 1, 2.',
        mFlow:'Every combination was checked on JDK 21 with a `peek` in front of each operation: the order matches.', lambdaT:'Lambda and stream objects', capt:'captures base',
        mLambda:'`a == b` was `false`. In a loop, a non-capturing lambda was the same object each time and a capturing one was a new object each time. Using the same stream twice threw `IllegalStateException`.'},
      ch:[
        ['Streams are lazy', ['`filter` and `map` do no work: they only build the pipeline. Without a terminal operation, no lambda runs.', 'Pick a terminal on the left, such as `toList`. Then Next starts working.']],
        ['Elements pass one by one', ['Many people think all elements go through `filter`, then all through `map`. They do not.', 'Each element goes through the whole pipeline before the next one starts, which avoids needless work.', 'Change the list and the operations on the left: the result is computed live.']],
        ['Short-circuit', ['`findFirst`, `anyMatch` and `limit` can end the work early. Once the result is found, the remaining elements are never read.', 'There are 6 elements here, but only 2 are processed. This is also why infinite streams work: `Stream.iterate(...).limit(5)`.']],
        ['sorted holds them all', ['`sorted` is a stateful operation: it must see every element to sort. So elements pile up in front of it.', 'A later `limit(2)` saves nothing, as everything is read from the source. Where you can, put `filter` before `sorted`.', '`distinct` also remembers every value it saw, but it lets elements through at once.']],
        ['count sometimes runs nothing', ['Here the `map` lambda does not run even once. Since JDK 9, when the size is known, `count` does not visit the elements.', 'Add a `filter`: the size is no longer known and the lambda runs. Try it on the left.', 'Trap: do not rely on side effects in `peek` or `map`, because they may not run.']],
        ['A lambda is an object', ['A lambda is an object of a functional interface. The values it captures are copied into that object, so a local variable must be effectively final.', 'A non-capturing lambda usually stays one object, while a capturing one may create a new object each time.', 'A stream is single-use: it cannot run again after its terminal.']],
      ]},
  },
};
