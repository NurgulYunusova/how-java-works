/* ---------- Objects in memory ---------- */
const LY_SIZE = {byte:1, boolean:1, char:2, short:2, int:4, float:4, long:8, double:8};
const ly8 = n => Math.ceil(n / 8) * 8;
/* HotSpot 15+ field layout (FieldLayoutBuilder): primitives largest first, then references, each into the smallest hole that fits.
   Checked against 600 random classes on JDK 21: sizes and slots match. JDK 21 sorts with an unstable qsort,
   so fields of the same size may swap places with each other on a real JVM. */
function lyLayout(types, coops) {
  const sz = t => LY_SIZE[t] || (coops ? 4 : 8);
  const blocks = [{off:0, size:12, kind:'h'}, {off:12, size:Infinity, kind:'e'}];
  const all = types.map((t, i) => ({t, i, size:sz(t)}));
  const prim = all.filter(f => LY_SIZE[f.t]).sort((a, b) => b.size - a.size || a.i - b.i);
  const refs = all.filter(f => !LY_SIZE[f.t]);
  const offs = [];
  const add = list => {
    let lastSize = 0, lastOk = false;
    for (const f of list) {
      const pad = b => b.off % f.size ? f.size - b.off % f.size : 0;
      let cand = null;
      if (f.size === lastSize && !lastOk) cand = blocks[blocks.length - 1];
      else {
        lastSize = f.size; lastOk = true;
        for (let k = blocks.length - 2; k > 0; k--) { const b = blocks[k]; if (b.kind === 'e' && b.size >= f.size + pad(b) && (!cand || b.size < cand.size)) cand = b; }
        if (!cand) { cand = blocks[blocks.length - 1]; lastOk = false; }
      }
      let k = blocks.indexOf(cand);
      const adj = pad(cand);
      if (adj) { blocks.splice(k, 0, {off:cand.off, size:adj, kind:'e'}); k++; cand.off += adj; cand.size -= adj; }
      blocks.splice(k, 0, {off:cand.off, size:f.size, kind:'f'});
      offs[f.i] = cand.off; cand.off += f.size; cand.size -= f.size;
      if (cand.size === 0) blocks.splice(k + 1, 1);
    }
  };
  add(prim); add(refs);
  return {offs, size:ly8(blocks[blocks.length - 1].off)};
}
/* What the size would be if fields stayed in declared order, as a C struct would. */
function lyNaive(types, coops) {
  let off = 12;
  types.forEach(t => { const s = LY_SIZE[t] || (coops ? 4 : 8); off = Math.ceil(off / s) * s + s; });
  return ly8(off);
}
const LY_TYPES = ['byte', 'boolean', 'char', 'short', 'int', 'float', 'long', 'double', 'String'];
const LY_PRESET = {
  Mixed:[['byte', 'b'], ['long', 'l'], ['int', 'i'], ['boolean', 'f'], ['Object', 'o']],
  Person:[['String', 'name'], ['int', 'age'], ['boolean', 'active']],
  Point:[['int', 'x'], ['int', 'y']],
  Flags:[['boolean', 'a'], ['long', 'id'], ['boolean', 'b'], ['long', 'ts'], ['boolean', 'c']],
};
const lyKind = t => LY_SIZE[t] ? 'k-f' + LY_SIZE[t] : 'k-ref';
/* segs: [{off, len, cls, label, sub}] that cover 0..size. Fields never cross an 8-byte row, gaps can. */
function lyGrid(segs, size) {
  const parts = [];
  segs.forEach(s => {
    let o = s.off, left = s.len;
    while (left > 0) { const room = 8 - o % 8, n = Math.min(room, left); parts.push({...s, off:o, len:n, cont:o !== s.off}); o += n; left -= n; }
  });
  let html = '';
  for (let r = 0; r < size; r += 8) {
    const cells = parts.filter(p => p.off >= r && p.off < r + 8).map(p => `<span class="lyc ${p.cls}" style="grid-column:${p.off % 8 + 2} / span ${p.len}" title="${esc(p.label)} · ${p.off}">${p.cont && p.cls !== 'k-gap' && p.cls !== 'k-pad' ? '' : `<b>${esc(p.label)}</b>`}${p.sub && !p.cont ? `<small>${esc(p.sub)}</small>` : ''}</span>`).join('');
    html += `<div class="lyrow"><small>${r}</small>${cells}</div>`;
  }
  return `<div class="lygrid" role="img" aria-label="${size} byte">${html}</div>`;
}
function lyObjSegs(fields, coops) {
  const L = lyLayout(fields.map(f => f[0]), coops);
  const segs = [{off:0, len:8, cls:'k-mark', label:'mark word', sub:'8'}, {off:8, len:4, cls:'k-klass', label:'class', sub:'4'}];
  const placed = fields.map((f, i) => ({off:L.offs[i], len:LY_SIZE[f[0]] || (coops ? 4 : 8), cls:lyKind(f[0]), label:f[1], sub:f[0]})).sort((a, b) => a.off - b.off);
  let at = 12;
  placed.forEach(p => { if (p.off > at) segs.push({off:at, len:p.off - at, cls:'k-gap', label:lu('gap')}); segs.push(p); at = p.off + p.len; });
  if (L.size > at) segs.push({off:at, len:L.size - at, cls:'k-pad', label:'padding'});
  const used = placed.reduce((s, p) => s + p.len, 0);
  return {segs, L, used, placed};
}
const LY_MW = {thin:0x16b932aa0n, fat:0x7d28a8e02n, hash:0x63947c6bn};
function lyMark(st) {
  if (st.lock === 'thin') return LY_MW.thin;
  if (st.lock === 'fat') return LY_MW.fat;
  return (st.hash ? LY_MW.hash << 8n : 0n) | (BigInt(st.age) << 3n) | 1n;
}
const lyHex = v => '0x' + v.toString(16).padStart(16, '0').replace(/(.{4})(?=.)/g, '$1 ');
function lyBits(st) {
  const v = lyMark(st), locked = st.lock !== 'none';
  const cls = b => b < 2 ? 'b-lock' : locked ? 'b-ptr' : b >= 3 && b <= 6 ? 'b-age' : b >= 8 && b <= 38 ? 'b-hash' : 'b-un';
  const row = from => Array.from({length:32}, (_, k) => { const b = from - k; return `<i class="${cls(b)}">${(v >> BigInt(b)) & 1n}</i>`; }).join('');
  return `<div class="lymw" aria-label="${lyHex(v)}"><div>${row(63)}</div><div>${row(31)}</div></div>`;
}
const LY_ARR = {int:[4, 0], long:[8, 0], byte:[1, 0], boolean:[1, 0], 'Integer (-128..127)':[4, 0], 'Integer (1000+)':[4, 16]};
const LY_COLL = [['int[]', 4016, 4016], ['Integer[]', 20016, 24016], ['ArrayList<Integer>', 20976, 25920], ['LinkedList<Integer>', 40032, 56040], ['TreeMap<Integer,Integer>', 56048, 72080], ['HashMap<Integer,Integer>', 56256, 72464], ['HashSet<Integer>', 56288, 72504]];
const LY_32 = [['new Object()', 16, 16], ['Integer', 16, 16], ['Long', 24, 24], ['String', 24, 32], ['ArrayList', 24, 32], ['HashMap', 48, 64], ['HashMap.Node', 32, 40], ['Integer[100]', 416, 816]];
function lyBars(rows, unit) {
  const max = Math.max(...rows.map(r => r[1]));
  return `<div class="lybars">${rows.map(r => `<div class="barrow"><span><code class="bare">${esc(r[0])}</code></span><div class="hbar"><i style="width:${(r[1] / max * 100).toFixed(1)}%${r[2] ? ';background:' + r[2] : ''}"></i></div><b>${esc(r[3] || r[1].toLocaleString('en-US').replace(/,/g, ' ') + ' ' + unit)}</b></div>`).join('')}</div>`;
}
LS.layout = {
  init(i) {
    if (i === 0) return {hash:false, age:0, lock:'none', saved:null, ev:'new'};
    if (i === 1) return {f:LY_PRESET.Mixed.map(x => x.slice()), p:'Mixed'};
    if (i === 2) return {t:'Integer (1000+)', n:3};
    if (i === 4) return {big:false};
    return {};
  },
  controls(st, ch) {
    const b = (act, v, label, sel, dis) => `<button class="btn${sel ? ' sel' : ''}" type="button" data-act="${act}"${v !== undefined ? ` data-v="${esc(v)}"` : ''}${sel !== undefined ? ` aria-pressed="${!!sel}"` : ''}${dis ? ' disabled' : ''}>${label}</button>`;
    if (ch === 0) {
      const un = st.lock === 'none';
      return `<div class="stepbar">${b('hash', undefined, '<code class="bare">o.hashCode()</code>', undefined, !un || st.hash)}${b('gc', undefined, esc(lu('survive')), undefined, !un || st.age >= 15)}${b('lock', undefined, '<code class="bare">synchronized (o) {</code>', undefined, !un)}${b('contend', undefined, esc(lu('contend')), undefined, st.lock !== 'thin')}${b('unlock', undefined, '<code class="bare">}</code>', undefined, un)}<button class="btn ghost" type="button" data-act="reset">${esc(LS_UI[LANG].reset)}</button></div>`;
    }
    if (ch === 1) {
      const full = st.f.length >= 10;
      return `<div class="stepbar"><span class="seg">${Object.keys(LY_PRESET).map(k => b('preset', k, `<code class="bare">${k}</code>`, st.p === k)).join('')}</span><span class="seg">${LY_TYPES.map(t => b('add', t, `<code class="bare">+ ${t}</code>`, undefined, full)).join('')}</span>${b('undo', undefined, esc(lu('undo')), undefined, !st.f.length)}${b('clear', undefined, esc(lu('clear')), undefined, !st.f.length)}</div>`;
    }
    if (ch === 2) return `<div class="stepbar"><span class="seg">${Object.keys(LY_ARR).map(k => b('type', k, `<code class="bare">${esc(k)}</code>`, st.t === k)).join('')}</span><span class="seg">${[0, 1, 3, 8, 100, 1000].map(n => b('len', n, `<code class="bare">[${n}]</code>`, st.n === n)).join('')}</span></div>`;
    if (ch === 4) return `<div class="stepbar"><span class="seg">${b('heap', '0', '<code class="bare">-Xmx31g</code>', !st.big)}${b('heap', '1', '<code class="bare">-Xmx32g</code>', st.big)}</span></div>`;
    return '';
  },
  stage(st, ch) {
    if (ch === 0) {
      const v = lyMark(st), lk = {none:'01', thin:'00', fat:'10'}[st.lock];
      const legend = st.lock === 'none'
        ? `<div class="legend">${tag('dead', 'unused')}${tag('pink', 'hash · 31 bit')}${tag('mint', 'age · 4 bit')}${tag('sun', 'lock · 2 bit')}</div>`
        : `<div class="legend">${tag('sky', st.lock === 'thin' ? lu('ptrThin') : lu('ptrFat'))}${tag('sun', 'lock · 2 bit')}</div>`;
      const facts = `<div class="gtext"><span><code>lock</code> <b>${lk}</b></span><span><code>age</code> <b>${st.lock === 'none' ? st.age : '–'}</b></span><span><code>hash</code> <b>${st.hash ? '0x63947c6b' : '0'}</b></span></div>`;
      const saved = st.lock !== 'none' ? `<p class="muted small">${rich(ls$('displaced', lyHex((st.hash ? LY_MW.hash << 8n : 0n) | (BigInt(st.age) << 3n) | 1n)))}</p>` : '';
      return pnl('Mark word', `<p class="lyhex">${lyHex(v)}</p>${lyBits(st)}${legend}${facts}<p class="explain-s">${rich(ls$(st.ev, st.age))}</p>${saved}`)
        + pnl('new Object()', lyGrid(lyObjSegs([], true).segs, 16) + `<p class="muted small">${rich(lu('objTotal'))}</p>`)
        + pnl('', measured(rich(lu('m0'))));
    }
    if (ch === 1) {
      const types = st.f.map(f => f[0]), o = lyObjSegs(st.f, true), naive = lyNaive(types, true);
      const src = `class Demo {\n${st.f.map(f => `    ${f[0]} ${f[1]};`).join('\n') || '    // ' + lu('noFields')}\n}`;
      const order = o.placed.map(p => `<span class="ch"><b>${esc(p.label)}</b><small>${p.off}</small></span>`).join('');
      const waste = o.L.size - 12 - o.used;
      const say = !st.f.length ? lu('emptyCls') : naive > o.L.size ? ls$('saved', naive, o.L.size) : waste ? ls$('waste', waste) : lu('tight');
      return pnl(lu('srcT'), `<pre class="logv">${esc(src)}</pre>`)
        + pnl(lu('memT'), `${lyGrid(o.segs, o.L.size)}<div class="gtext"><span><code>size</code> <b>${o.L.size} byte</b></span><span><code>header</code> <b>12</b></span><span><code>field</code> <b>${o.used}</b></span><span><code>${esc(lu('gapPad'))}</code> <b>${waste}</b></span><span><code>${esc(lu('declOrder'))}</code> <b>${naive} byte</b></span></div>${st.f.length ? `<h3 class="subh">${esc(lu('memOrder'))}</h3><div class="chars">${order}</div>` : ''}<p class="explain-s">${rich(say)}</p>`)
        + pnl('', measured(rich(lu('m1'))));
    }
    if (ch === 2) {
      const [es, box] = LY_ARR[st.t], shallow = ly8(16 + st.n * es), boxes = st.n * box, ref = /Integer/.test(st.t);
      let grid = '';
      if (st.n <= 8) {
        const segs = [{off:0, len:8, cls:'k-mark', label:'mark word', sub:'8'}, {off:8, len:4, cls:'k-klass', label:'class', sub:'4'}, {off:12, len:4, cls:'k-len', label:'length', sub:String(st.n)}];
        for (let i = 0; i < st.n; i++) segs.push({off:16 + i * es, len:es, cls:ref ? 'k-ref' : 'k-f' + es, label:`[${i}]`, sub:ref ? 'ref' : ''});
        if (shallow > 16 + st.n * es) segs.push({off:16 + st.n * es, len:shallow - 16 - st.n * es, cls:'k-pad', label:'padding'});
        grid = lyGrid(segs, shallow);
      } else grid = `<p class="muted">${rich(ls$('bigArr', st.n))}</p>`;
      const name = `${st.t.split(' ')[0]}[${st.n}]`;
      const rows = Object.keys(LY_ARR).map(k => { const [e, bx] = LY_ARR[k], tot = ly8(16 + st.n * e) + st.n * bx; return [`${k.split(' ')[0]}[] ${k.includes('(') ? k.slice(k.indexOf('(')) : ''}`.trim(), tot, k === st.t ? 'var(--sun)' : 'var(--lilac)']; });
      return pnl(name, `${grid}<div class="gtext"><span><code>${esc(lu('arrObj'))}</code> <b>${shallow} byte</b></span>${ref ? `<span><code>Integer object</code> <b>${st.n} × ${box} = ${boxes} byte</b></span>` : ''}<span><code>${esc(lu('total'))}</code> <b>${shallow + boxes} byte</b></span></div><p class="explain-s">${rich(st.t === 'boolean' ? lu('boolNote') : st.t === 'Integer (-128..127)' ? lu('cacheNote') : st.t === 'Integer (1000+)' ? ls$('boxNote', st.n) : ls$('primNote', es))}</p>`)
        + pnl(ls$('cmpT', st.n), lyBars(rows, 'byte') + measured(rich(lu('m2'))));
    }
    if (ch === 3) {
      const rows = LY_COLL.map(r => [r[0], r[1], r[0] === 'int[]' ? 'var(--sun)' : 'var(--lilac)', `${(r[1] / 1000).toFixed(1)} KB`]);
      return pnl(lu('collT'), lyBars(rows) + `<table class="demo"><thead><tr><th></th><th>${esc(lu('perEl'))}</th></tr></thead><tbody>${LY_COLL.map(r => `<tr><td><code>${esc(r[0])}</code></td><td><b>${(r[1] / 1000).toFixed(1)}</b> byte</td></tr>`).join('')}</tbody></table>` + measured(rich(lu('m3'))))
        + pnl(lu('nodeT'), lyGrid(lyObjSegs([['int', 'hash'], ['Object', 'key'], ['Object', 'value'], ['Object', 'next']], true).segs, 32) + `<p class="muted small">${rich(lu('nodeText'))}</p>`);
    }
    const co = !st.big, P = lyObjSegs(LY_PRESET.Person, co);
    return pnl(`Person · ${st.big ? '-Xmx32g' : '-Xmx31g'}`, `${lyGrid(P.segs, P.L.size)}<div class="gtext"><span><code>UseCompressedOops</code> <b>${co}</b></span><span><code>reference</code> <b>${co ? 4 : 8} byte</b></span><span><code>size</code> <b>${P.L.size} byte</b></span></div><p class="explain-s">${rich(co ? lu('coopsOn') : lu('coopsOff'))}</p>`)
      + pnl(lu('t32'), `<table class="demo"><thead><tr><th></th><th>-Xmx31g</th><th>-Xmx32g</th></tr></thead><tbody>${LY_32.map(r => `<tr><td><code>${esc(r[0])}</code></td><td>${co ? `<b>${r[1]}</b>` : r[1]}</td><td>${co ? r[2] : `<b>${r[2]}</b>`}</td></tr>`).join('')}<tr><td><code>HashMap&lt;Integer,Integer&gt;</code> × 1000</td><td>${co ? '<b>56 256</b>' : '56 256'}</td><td>${co ? '72 464' : '<b>72 464</b>'}</td></tr></tbody></table>` + measured(rich(lu('m4'))));
  },
  act(st, a, v, ch) {
    if (ch === 0) {
      if (a === 'reset') Object.assign(st, LS.layout.init(0));
      if (a === 'hash') { st.hash = true; st.ev = 'evHash'; }
      if (a === 'gc') { st.age = Math.min(15, st.age + 1); st.ev = st.age >= 15 ? 'evAgeMax' : 'evAge'; }
      if (a === 'lock') { st.lock = 'thin'; st.ev = 'evThin'; }
      if (a === 'contend') { st.lock = 'fat'; st.ev = 'evFat'; }
      if (a === 'unlock') { st.ev = st.lock === 'fat' ? 'evUnFat' : 'evUnThin'; st.lock = 'none'; }
    }
    if (ch === 1) {
      if (a === 'preset') { st.f = LY_PRESET[v].map(x => x.slice()); st.p = v; }
      if (a === 'add' && st.f.length < 10) { const used = new Set(st.f.map(f => f[1])); let n = 0; while (used.has('abcdefghijklmnopqrstuvwxyz'[n])) n++; st.f.push([v, 'abcdefghijklmnopqrstuvwxyz'[n]]); st.p = null; }
      if (a === 'undo') { st.f.pop(); st.p = null; }
      if (a === 'clear') { st.f = []; st.p = null; }
    }
    if (ch === 2) { if (a === 'type') st.t = v; if (a === 'len') st.n = +v; }
    if (ch === 4 && a === 'heap') st.big = v === '1';
  },
  text: {
    az: {title:'Object yaddaşda', door:'Bir object neçə byte tutur: header, mark word, padding, field sırası, array-lər və 32 GB sərhədi.',
      ui:{survive:'GC-dən sağ çıxdı', contend:'2-ci thread gözləyir', ptrThin:'thread stack-ində lock record-a pointer', ptrFat:'ObjectMonitor-a pointer',
        new:'Yeni object: hash hələ hesablanmayıb, age 0-dır, lock bit-ləri `01`, yəni kilidsizdir. Mark word-un dəyəri sadəcə `1`-dir.',
        evHash:'İlk `hashCode()` identity hash-i hesabladı və mark word-a yazdı: 31 bit, 8-ci bit-dən başlayır. Sonrakı çağırışlar onu buradan oxuyur.',
        evAge:a => `Object Young GC-dən sağ çıxdı və age ${a} oldu. Age 4 bit-dir, ona görə 15-dən böyük ola bilməz.`,
        evAgeMax:'Age 15-ə çatdı, 4 bit-ə daha böyük rəqəm sığmır. `MaxTenuringThreshold`-un ən böyük dəyərinin 15 olmasının səbəbi budur.',
        evThin:'Rəqabət yoxdur, ona görə thin lock işə düşdü. Köhnə mark word thread-in stack-indəki lock record-a köçürülür. Mark word-un özü isə o record-a pointer olur və sonu `00` ilə bitir.',
        evFat:'İkinci thread eyni object-i istədi, thin lock artıq bəs etmir. JVM `ObjectMonitor` yaradır, mark word ona pointer olur və sonu `10` ilə bitir. Gözləyən thread monitor-un növbəsində dayanır.',
        evUnThin:'Kilid buraxıldı: köhnə mark word stack-dən geri yazıldı. Hash və age itmir.',
        evUnFat:'Kilid buraxıldı. Sadələşdirilmiş model: real JVM monitor-u dərhal yox, sonra deflate edir.',
        displaced:h => `Stack-də saxlanan köhnə mark word: \`${h}\``,
        objTotal:'Mark word 8 byte, class pointer 4 byte tutur. Object 8-ə bölünən ünvanda başlamalıdır, ona görə 12 byte 16-ya qədər doldurulur.',
        m0:'Dəyərlər JDK 21-də `Unsafe.getLong(o, 0)` ilə oxunub: yeni object `0x1`, `hashCode()`-dan sonra `0x63947c6b01`, bir neçə Young GC-dən sonra age 7, 14 və 15. Thin lock-un sonu `00`, rəqabətli lock-un sonu `10` oldu.',
        gap:'boşluq', undo:'Sonuncunu sil', clear:'Təmizlə', srcT:'Kodda', memT:'Yaddaşda', noFields:'field yoxdur', gapPad:'boşluq', declOrder:'elan sırası ilə', memOrder:'Yaddaşdakı sıra və offset',
        emptyCls:'Field olmayan object də 16 byte tutur: 12 byte header və 4 byte padding.',
        saved:(n, s) => `Field-lər yazıldığı sıra ilə düzülsəydi, object ${n} byte tutardı. JVM onları ölçüyə görə düzür, boşluqları kiçik field-lərlə doldurur və object ${s} byte olur.`,
        waste:w => `${w} byte boşluq qaldı: object-in ölçüsü 8-ə bölünməlidir.`, tight:'Boşluq yoxdur: field-lər header-dən sonrakı yerə tam sığdı.',
        m1:'Bu düzülüş HotSpot-un alqoritmidir. 600 təsadüfi class-da JDK 21 ilə yoxlanılıb: ölçü və hər ölçünün yeri hamısında uyğun gəldi. Eyni ölçülü field-lər real JVM-də bəzən öz aralarında yer dəyişir, çünki JDK 21 onları qeyri-sabit `qsort` ilə sıralayır.',
        arrObj:'array object-i', total:'cəmi', bigArr:n => `${n} element şəkildə göstərmək üçün çoxdur. Ölçü yenə eyni qayda ilə hesablanır: 16 byte header və element-lər.`,
        boolNote:'`boolean` 1 bit yox, 1 byte tutur. Çoxlu bayraq lazımdırsa, `BitSet` hər birinə 1 bit verir.',
        cacheNote:'-128-dən 127-yə qədər `Integer`-lər cache-dən gəlir: array yalnız reference saxlayır, yeni object yaranmır.',
        boxNote:n => `Array-də yalnız reference-lər var. ${n} \`Integer\` heap-də ayrıca object-dir və hər biri 16 byte tutur: 12 byte header və 4 byte \`int\`.`,
        primNote:es => `Primitive array dəyərləri birbaşa özündə saxlayır: hər element ${es} byte. Header-dən sonra boşluq yoxdur.`,
        cmpT:n => `${n} element: hamısı birlikdə`, m2:'JDK 21-də ölçülüb: `int[0]` 16, `byte[3]` 24, `long[3]` 40, `boolean[10]` 32, `int[100]` 416 byte. `Integer[100]` 416 byte, üstəlik 100 `Integer` 1600 byte, cəmi 2016.',
        collT:'1000 ədəd (1000-1999) saxlamaq', perEl:'bir element üçün', nodeT:'HashMap.Node',
        nodeText:'Hər `put` belə bir Node yaradır: `hash`, `key`, `value` və `next`. Üstəlik key və value-nun öz `Integer` object-ləri var.',
        m3:'Hər collection reflection ilə dərindən gəzildi və bütün object-lərin ölçüsü `Instrumentation.getObjectSize` ilə toplandı. JDK 21, compressed oops açıqdır.',
        coopsOn:'Heap 32 GB-dan kiçikdir, ona görə reference 4 byte-dır. JVM 32 bit-lik offset saxlayır və onu 8-ə vurur: 2³² × 8 = 32 GB. Bu, object-lərin 8-ə bölünən ünvanda başlaması sayəsində mümkündür.',
        coopsOff:'Heap 32 GB oldu, 4 byte-lıq offset artıq çatmır. JVM compressed oops-u özü söndürür və hər reference 8 byte olur. Ona görə 32 GB-lıq heap-ə 31 GB-lıqdan az object sığa bilər.',
        t32:'Eyni object-lər, iki heap ölçüsü',
        m4:'`-Xmx31g` ilə `UseCompressedOops = true`, `-Xmx32g` ilə `false` oldu. Ölçülər hər iki halda JDK 21-də götürülüb. Class pointer hər iki halda 4 byte qalır.'},
      ch:[
        ['Header: hər object-in 12 byte-ı', ['Heap-dəki hər object header ilə başlayır. 8 byte mark word, 4 byte isə class pointer-dir, yəni object-in class-ı.', 'Mark word bir neçə iş görür: identity hash, GC age və kilid vəziyyəti. Hamısı eyni 64 bit-də yerləşir. Kilid tutulanda bu bit-lər pointer-ə çevrilir.', 'Düymələri bas və bit-lərin necə dəyişdiyinə bax. Java 18-dən biased locking yoxdur, ona görə burada da göstərilmir.']],
        ['Field-lər və padding', ['Field-lər yazıldığı sıra ilə düzülmür. JVM əvvəl böyük primitive-ləri, sonra kiçikləri, ən sonda reference-ləri yerləşdirir. Hər field üçün ona sığan ən kiçik boşluğu seçir.', 'Hər field öz ölçüsünə bölünən offset-də başlayır: `long` 8-ə, `int` 4-ə bölünən yerdə. Object-in ölçüsü isə 8-ə bölünməlidir.', 'Öz class-ını qur və byte-ların necə yerləşdiyinə bax. Header-dən sonrakı 4 byte-ı çox vaxt bir `int` və ya reference doldurur.']],
        ['Array-lər', ['Array-in header-i 16 byte-dır: mark word, class pointer və 4 byte `length`. Element-lər onun ardınca gəlir.', 'Primitive array dəyərləri özündə saxlayır. `Integer[]` isə yalnız reference saxlayır, hər `Integer` heap-də ayrıca 16 byte-lıq object-dir.', 'Ona görə 100 ədəd üçün `int[]` 416 byte tutur, `Integer[]` isə 2016 byte.']],
        ['Collection-ların qiyməti', ['Collection-lar primitive saxlaya bilmir, hər ədəd `Integer` olur. Üstəlik hər element üçün daxili object-lər yaranır: HashMap-də `Node`, LinkedList-də ikiqat bağlı Node.', '1000 ədəd `int[]`-də 4 KB, `HashSet<Integer>`-də isə 56 KB tutur, yəni 14 dəfə çox. Milyonlarla element olanda bu fərq vacibdir.', 'Primitive-lər üçün xüsusi collection-lar var, məsələn Eclipse Collections və fastutil kitabxanalarında. Onlar `int[]` kimi az yer tutur.']],
        ['32 GB sərhədi', ['64-bit JVM-də pointer 8 byte-dır, amma heap kiçikdirsə JVM onu 4 byte-a sıxır: compressed oops.', '4 byte-a 2³² fərqli dəyər sığır. JVM bunu 8-ə vurur, çünki object-lər 8-ə bölünən ünvanda başlayır. Nəticədə 32 GB-a qədər ünvan almaq olur.', 'Heap-i 31 GB-dan 32 GB-a qaldır və reference-lərin ölçüsünə bax. Java 25-də compact object headers də var: header 12 byte əvəzinə 8 byte tutur.']],
      ]},
    tr: {title:'Object bellekte', door:'Bir object kaç byte tutar: header, mark word, padding, field sırası, array’ler ve 32 GB sınırı.',
      ui:{survive:"GC'den sağ çıktı", contend:'2. thread bekliyor', ptrThin:"thread stack'indeki lock record'a pointer", ptrFat:"ObjectMonitor'a pointer",
        new:"Yeni object: hash henüz hesaplanmadı, age 0, lock bit'leri `01`, yani kilitsiz. Mark word'ün değeri sadece `1`.",
        evHash:"İlk `hashCode()` identity hash'i hesapladı ve mark word'e yazdı: 31 bit, 8. bit'ten başlıyor. Sonraki çağrılar onu buradan okur.",
        evAge:a => `Object Young GC'den sağ çıktı ve age ${a} oldu. Age 4 bit'tir, bu yüzden 15'ten büyük olamaz.`,
        evAgeMax:"Age 15'e ulaştı, 4 bit'e daha büyük sayı sığmaz. `MaxTenuringThreshold`'un en büyük değerinin 15 olmasının nedeni budur.",
        evThin:"Rekabet yok, bu yüzden thin lock devreye girdi. Eski mark word thread'in stack'indeki lock record'a taşınır. Mark word'ün kendisi ise o record'a pointer olur ve `00` ile biter.",
        evFat:"İkinci thread aynı object'i istedi, thin lock artık yetmez. JVM bir `ObjectMonitor` oluşturur, mark word ona pointer olur ve `10` ile biter. Bekleyen thread monitor'ün kuyruğunda durur.",
        evUnThin:"Kilit bırakıldı: eski mark word stack'ten geri yazıldı. Hash ve age kaybolmaz.",
        evUnFat:"Kilit bırakıldı. Basitleştirilmiş model: gerçek JVM monitor'ü hemen değil, sonra deflate eder.",
        displaced:h => `Stack'te saklanan eski mark word: \`${h}\``,
        objTotal:"Mark word 8 byte, class pointer 4 byte tutar. Object 8'e bölünen bir adreste başlamalı, bu yüzden 12 byte 16'ya tamamlanır.",
        m0:"Değerler JDK 21'de `Unsafe.getLong(o, 0)` ile okundu: yeni object `0x1`, `hashCode()` sonrası `0x63947c6b01`, birkaç Young GC sonrası age 7, 14 ve 15. Thin lock `00`, rekabetli lock `10` ile bitti.",
        gap:'boşluk', undo:'Sonuncuyu sil', clear:'Temizle', srcT:'Kodda', memT:'Bellekte', noFields:'field yok', gapPad:'boşluk', declOrder:'tanım sırasıyla', memOrder:'Bellekteki sıra ve offset',
        emptyCls:"Field'ı olmayan object de 16 byte tutar: 12 byte header ve 4 byte padding.",
        saved:(n, s) => `Field'lar yazıldıkları sırayla dizilseydi object ${n} byte tutardı. JVM onları boyuta göre dizer, boşlukları küçük field'larla doldurur ve object ${s} byte olur.`,
        waste:w => `${w} byte boşluk kaldı: object'in boyutu 8'e bölünmeli.`, tight:"Boşluk yok: field'lar header'dan sonraki yere tam sığdı.",
        m1:"Bu dizilim HotSpot'un algoritmasıdır. 600 rastgele class'ta JDK 21 ile karşılaştırıldı: boyut ve her boyutun yeri hepsinde tuttu. Aynı boyuttaki field'lar gerçek JVM'de bazen kendi aralarında yer değiştirir, çünkü JDK 21 onları kararsız bir `qsort` ile sıralar.",
        arrObj:"array object'i", total:'toplam', bigArr:n => `${n} element şekilde göstermek için çok fazla. Boyut yine aynı kuralla hesaplanır: 16 byte header ve element'ler.`,
        boolNote:"`boolean` 1 bit değil, 1 byte tutar. Çok sayıda bayrak gerekiyorsa `BitSet` her birine 1 bit verir.",
        cacheNote:"-128 ile 127 arasındaki `Integer`'lar cache'ten gelir: array sadece reference tutar, yeni object oluşmaz.",
        boxNote:n => `Array'de sadece reference'lar var. ${n} \`Integer\` heap'te ayrı bir object'tir ve her biri 16 byte tutar: 12 byte header ve 4 byte \`int\`.`,
        primNote:es => `Primitive array değerleri doğrudan kendisinde tutar: her element ${es} byte. Header'dan sonra boşluk yok.`,
        cmpT:n => `${n} element: hepsi birlikte`, m2:"JDK 21'de ölçüldü: `int[0]` 16, `byte[3]` 24, `long[3]` 40, `boolean[10]` 32, `int[100]` 416 byte. `Integer[100]` 416 byte, ayrıca 100 `Integer` 1600 byte, toplam 2016.",
        collT:'1000 sayı (1000-1999) saklamak', perEl:'element başına', nodeT:'HashMap.Node',
        nodeText:"Her `put` böyle bir Node oluşturur: `hash`, `key`, `value` ve `next`. Ayrıca key ve value'nun kendi `Integer` object'leri var.",
        m3:"Her collection reflection ile derinlemesine gezildi ve tüm object'lerin boyutu `Instrumentation.getObjectSize` ile toplandı. JDK 21, compressed oops açık.",
        coopsOn:"Heap 32 GB'tan küçük, bu yüzden reference 4 byte. JVM 32 bit'lik bir offset tutar ve onu 8 ile çarpar: 2³² × 8 = 32 GB. Bu, object'lerin 8'e bölünen adreste başlaması sayesinde mümkün.",
        coopsOff:"Heap 32 GB oldu, 4 byte'lık offset artık yetmez. JVM compressed oops'u kendisi kapatır ve her reference 8 byte olur. Bu yüzden 32 GB'lık heap'e 31 GB'lıktan daha az object sığabilir.",
        t32:"Aynı object'ler, iki heap boyutu",
        m4:"`-Xmx31g` ile `UseCompressedOops = true`, `-Xmx32g` ile `false` oldu. Boyutlar iki durumda da JDK 21'de alındı. Class pointer iki durumda da 4 byte kalır."},
      ch:[
        ["Header: her object'in 12 byte'ı", ["Heap'teki her object bir header ile başlar. 8 byte mark word, 4 byte ise class pointer'dır, yani object'in class'ı.", "Mark word birkaç iş görür: identity hash, GC age ve kilit durumu. Hepsi aynı 64 bit'te durur. Kilit alınınca bu bit'ler bir pointer'a dönüşür.", "Düğmelere bas ve bit'lerin nasıl değiştiğine bak. Java 18'den beri biased locking yok, bu yüzden burada da gösterilmiyor."]],
        ['Field’lar ve padding', ["Field'lar yazıldıkları sırayla dizilmez. JVM önce büyük primitive'leri, sonra küçükleri, en sonda reference'ları yerleştirir. Her field için ona sığan en küçük boşluğu seçer.", "Her field kendi boyutuna bölünen bir offset'te başlar: `long` 8'e, `int` 4'e bölünen yerde. Object'in boyutu ise 8'e bölünmeli.", "Kendi class'ını kur ve byte'ların nasıl yerleştiğine bak. Header'dan sonraki 4 byte'ı çoğu zaman bir `int` veya reference doldurur."]],
        ['Array’ler', ["Array'in header'ı 16 byte'tır: mark word, class pointer ve 4 byte `length`. Element'ler onun ardından gelir.", "Primitive array değerleri kendisinde tutar. `Integer[]` ise sadece reference tutar, her `Integer` heap'te ayrı 16 byte'lık bir object'tir.", "Bu yüzden 100 sayı için `int[]` 416 byte, `Integer[]` ise 2016 byte tutar."]],
        ["Collection'ların bedeli", ["Collection'lar primitive tutamaz, her sayı bir `Integer` olur. Ayrıca her element için iç object'ler oluşur: HashMap'te `Node`, LinkedList'te çift bağlı Node.", "1000 sayı `int[]`'de 4 KB, `HashSet<Integer>`'da ise 56 KB tutar, yani 14 kat fazla. Milyonlarca element olunca bu fark önemlidir.", "Primitive'ler için özel collection'lar var, örneğin Eclipse Collections ve fastutil kütüphanelerinde. Onlar `int[]` gibi az yer tutar."]],
        ['32 GB sınırı', ["64-bit JVM'de pointer 8 byte'tır, ama heap küçükse JVM onu 4 byte'a sıkıştırır: compressed oops.", "4 byte'a 2³² farklı değer sığar. JVM bunu 8 ile çarpar, çünkü object'ler 8'e bölünen adreste başlar. Sonuçta 32 GB'a kadar adreslenebilir.", "Heap'i 31 GB'tan 32 GB'a çıkar ve reference'ların boyutuna bak. Java 25'te compact object headers da var: header 12 byte yerine 8 byte tutar."]],
      ]},
    en: {title:'Objects in memory', door:'How many bytes an object takes: header, mark word, padding, field order, arrays and the 32 GB line.',
      ui:{survive:'Survived a GC', contend:'A 2nd thread waits', ptrThin:'pointer to a lock record on the thread stack', ptrFat:'pointer to an ObjectMonitor',
        new:'A new object: no hash yet, age 0, lock bits `01`, which means unlocked. The mark word is just `1`.',
        evHash:'The first `hashCode()` computed the identity hash and wrote it into the mark word: 31 bits, starting at bit 8. Later calls read it from there.',
        evAge:a => `The object survived a young GC and its age is now ${a}. Age has 4 bits, so it cannot go above 15.`,
        evAgeMax:'Age reached 15, and a larger number does not fit in 4 bits. That is why the largest value of `MaxTenuringThreshold` is 15.',
        evThin:'There is no contention, so a thin lock is used. The old mark word moves to a lock record on the thread stack. The mark word itself becomes a pointer to that record and ends in `00`.',
        evFat:'A second thread wants the same object, so a thin lock is no longer enough. The JVM creates an `ObjectMonitor`, the mark word points to it and ends in `10`. The waiting thread queues on the monitor.',
        evUnThin:'The lock is released and the old mark word is written back from the stack. The hash and age are kept.',
        evUnFat:'The lock is released. Simplified model: a real JVM deflates the monitor later, not right away.',
        displaced:h => `The old mark word saved on the stack: \`${h}\``,
        objTotal:'The mark word takes 8 bytes and the class pointer 4. An object must start at an address divisible by 8, so 12 bytes are padded to 16.',
        m0:'Values were read on JDK 21 with `Unsafe.getLong(o, 0)`: a new object is `0x1`, after `hashCode()` it is `0x63947c6b01`, and after several young GCs the age was 7, 14 and 15. A thin lock ended in `00` and a contended lock in `10`.',
        gap:'gap', undo:'Remove last', clear:'Clear', srcT:'In code', memT:'In memory', noFields:'no fields', gapPad:'gaps', declOrder:'in declared order', memOrder:'Order and offset in memory',
        emptyCls:'An object with no fields still takes 16 bytes: a 12-byte header and 4 bytes of padding.',
        saved:(n, s) => `In declared order, the object would take ${n} bytes. The JVM sorts fields by size, fills gaps with small fields, and the object takes ${s} bytes.`,
        waste:w => `${w} bytes are left empty, because the object size must be divisible by 8.`, tight:'No gaps: the fields fit exactly after the header.',
        m1:'This is the HotSpot algorithm. It was compared with JDK 21 on 600 random classes: the size and the slot of each field size matched in all of them. On a real JVM, fields of the same size sometimes swap places with each other, because JDK 21 sorts them with an unstable `qsort`.',
        arrObj:'array object', total:'total', bigArr:n => `${n} elements are too many to draw. The size follows the same rule: a 16-byte header plus the elements.`,
        boolNote:'A `boolean` takes 1 byte, not 1 bit. If you need many flags, a `BitSet` gives each one 1 bit.',
        cacheNote:'`Integer` values from -128 to 127 come from a cache: the array holds only references and no new objects are created.',
        boxNote:n => `The array holds only references. Each of the ${n} \`Integer\` values is a separate heap object of 16 bytes: a 12-byte header and a 4-byte \`int\`.`,
        primNote:es => `A primitive array holds the values directly: ${es} bytes per element, with no gap after the header.`,
        cmpT:n => `${n} elements, everything included`, m2:'Measured on JDK 21: `int[0]` 16, `byte[3]` 24, `long[3]` 40, `boolean[10]` 32 and `int[100]` 416 bytes. `Integer[100]` is 416 bytes, plus 1600 bytes for 100 `Integer` objects, 2016 in total.',
        collT:'Storing 1000 numbers (1000-1999)', perEl:'per element', nodeT:'HashMap.Node',
        nodeText:'Every `put` creates a Node like this one: `hash`, `key`, `value` and `next`. The key and value also have their own `Integer` objects.',
        m3:'Each collection was walked deeply with reflection, and the sizes of all objects were summed with `Instrumentation.getObjectSize`. JDK 21, compressed oops on.',
        coopsOn:'The heap is below 32 GB, so a reference takes 4 bytes. The JVM stores a 32-bit offset and multiplies it by 8: 2³² × 8 = 32 GB. This works because objects start at addresses divisible by 8.',
        coopsOff:'The heap is now 32 GB and a 4-byte offset is no longer enough. The JVM turns compressed oops off by itself and every reference takes 8 bytes. So a 32 GB heap can hold fewer objects than a 31 GB one.',
        t32:'The same objects, two heap sizes',
        m4:'With `-Xmx31g`, `UseCompressedOops = true`; with `-Xmx32g`, it is `false`. Sizes were measured on JDK 21 in both cases. The class pointer stays 4 bytes in both.'},
      ch:[
        ['The header: 12 bytes in every object', ['Every object on the heap starts with a header: an 8-byte mark word and a 4-byte class pointer, which says what class the object is.', 'The mark word does several jobs: the identity hash, the GC age and the lock state, all in the same 64 bits. When the object is locked, those bits become a pointer.', 'Press the buttons and watch the bits change. Biased locking has been gone since Java 18, so it is not shown here.']],
        ['Fields and padding', ['Fields are not stored in the order you write them. The JVM places large primitives first, then smaller ones, and references last. Each field goes into the smallest gap it fits.', 'Each field starts at an offset divisible by its size: a `long` at a multiple of 8, an `int` at a multiple of 4. The object size must be divisible by 8.', 'Build your own class and watch where the bytes go. The 4 bytes right after the header are often filled by an `int` or a reference.']],
        ['Arrays', ['An array header takes 16 bytes: the mark word, the class pointer and a 4-byte `length`. The elements follow it.', 'A primitive array holds the values itself. An `Integer[]` holds only references, and each `Integer` is a separate 16-byte object on the heap.', 'That is why 100 numbers take 416 bytes in an `int[]` and 2016 bytes in an `Integer[]`.']],
        ['What collections cost', ['Collections cannot hold primitives, so every number becomes an `Integer`. Each element also gets internal objects: a `Node` in HashMap, a doubly linked Node in LinkedList.', '1000 numbers take 4 KB in an `int[]` and 56 KB in a `HashSet<Integer>`, 14 times more. With millions of elements, that difference matters.', 'Libraries such as Eclipse Collections and fastutil have collections for primitives. They take about as little space as an `int[]`.']],
        ['The 32 GB line', ['On a 64-bit JVM a pointer is 8 bytes, but when the heap is small the JVM squeezes it into 4 bytes: compressed oops.', '4 bytes hold 2³² different values. The JVM multiplies them by 8, because objects start at addresses divisible by 8. That reaches up to 32 GB.', 'Raise the heap from 31 GB to 32 GB and watch the reference size. Java 25 also has compact object headers, where the header takes 8 bytes instead of 12.']],
      ]},
  },
};
