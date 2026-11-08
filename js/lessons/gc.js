/* ---------- Garbage Collection ---------- */
const GC_SCRIPTS = {
  0: {roots:['o', 'c'], objs:{A:['Order', 210, 40], B:['Customer', 500, 130]},
      code:['Order o = new Order();', 'Customer c = new Customer();', 'o.customer = c;', 'c = null;', 'o = null;'],
      steps:[[0,'o=new A'], [1,'c=new B'], [2,'A.customer=B'], [3,'c=null'], [4,'o=null']]},
  1: {roots:['x', 'y'], objs:{A:['Node', 210, 30], B:['Node', 500, 130]},
      code:['Node x = new Node();', 'Node y = new Node();', 'x.other = y;', 'y.other = x;', 'x = null;', 'y = null;', 'System.gc();'],
      steps:[[0,'x=new A'], [1,'y=new B'], [2,'A.other=B'], [3,'B.other=A'], [4,'x=null'], [5,'y=null'], [6,'mark'], [6,'sweep']]},
  3: {roots:['cache (static)', 'o'], objs:{L:['ArrayList', 210, 30], A:['Order', 530, 130]},
      code:['static List<Order> cache = new ArrayList<>();', 'Order o = new Order();', 'cache.add(o);', 'o = null;', 'cache.clear();'],
      steps:[[0,'cache (static)=new L'], [1,'o=new A'], [2,'L.elementData[0]=A'], [3,'o=null'], [4,'L.elementData[0]=null']]},
};
function gcReplay(sc, upto) {
  const st = {roots:{}, live:new Set(), refs:{}, phase:null, gone:new Set()};
  sc.roots.forEach(r => { st.roots[r] = null; });
  for (let i = 0; i < upto; i++) {
    const c = sc.steps[i][1];
    if (c === 'mark') { st.phase = 'mark'; continue; }
    if (c === 'sweep') { st.phase = 'sweep'; const re = gcReach(st); [...st.live].forEach(id => { if (!re.has(id)) { st.live.delete(id); st.gone.add(id); } }); continue; }
    const m = /^(.+)=(new )?(\w+)$/.exec(c), lhs = m[1], val = m[3] === 'null' ? null : m[3];
    if (m[2]) { st.live.add(val); st.refs[val] = {}; }
    const dot = /^(\w)\.(.+)$/.exec(lhs);
    if (dot) { if (val) st.refs[dot[1]][dot[2]] = val; else delete st.refs[dot[1]][dot[2]]; }
    else st.roots[lhs] = val;
  }
  return st;
}
function gcReach(st) {
  const seen = new Set(), q = Object.values(st.roots).filter(Boolean);
  while (q.length) { const x = q.pop(); if (seen.has(x)) continue; seen.add(x); Object.values(st.refs[x] || {}).forEach(y => q.push(y)); }
  return seen;
}
function gcGraph(sc, st) {
  const reach = gcReach(st), W = 700, H = 210;
  const rootY = i => 34 + i * 72;
  const edge = (x1, y1, x2, y2, cls, label, bend) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + (bend || 0);
    return `<path class="ge ${cls}" d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" marker-end="url(#gar)"/>${label ? `<text class="gl" x="${mx}" y="${my - 12}" text-anchor="middle">${esc(label)}</text>` : ''}`;
  };
  let edges = '', nodes = '';
  sc.roots.forEach((r, i) => {
    const y = rootY(i), v = st.roots[r];
    nodes += `<g class="groot"><rect x="8" y="${y}" width="130" height="42" rx="8"/><text x="73" y="${y + 26}" text-anchor="middle">${esc(r)}</text></g>`;
    if (v) { const o = sc.objs[v]; edges += edge(138, y + 21, o[1] - 2, o[2] + 21, 'root', ''); }
    else nodes += `<text class="gnull" x="150" y="${y + 26}">null</text>`;
  });
  [...st.live].forEach(id => {
    const o = sc.objs[id];
    Object.entries(st.refs[id]).forEach(([f, to]) => {
      const p = sc.objs[to], back = p[1] < o[1];
      edges += edge(back ? o[1] + 20 : o[1] + 150, back ? o[2] + 42 : o[2] + 21, back ? p[1] + 130 : p[1] - 2, back ? p[2] + 42 : p[2] + 21, reach.has(id) ? '' : 'dead', f, back ? 46 : -14);
    });
    const dead = !reach.has(id), marked = st.phase === 'mark' && !dead;
    nodes += `<g class="gobj${dead ? ' dead' : ''}${marked ? ' marked' : ''}"><rect x="${o[1]}" y="${o[2]}" width="150" height="42" rx="8"/><text x="${o[1] + 75}" y="${o[2] + 26}" text-anchor="middle">${esc(o[0])}</text></g>`;
  });
  [...st.gone].forEach(id => { const o = sc.objs[id]; nodes += `<rect class="ggone" x="${o[1]}" y="${o[2]}" width="150" height="42" rx="8"/>`; });
  return `<svg class="gsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="GC roots"><defs><marker id="gar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#B3B8E2"/></marker></defs>${edges}${nodes}</svg>`;
}
function gcLegend(st, sc) {
  const dead = [...st.live].filter(x => !gcReach(st).has(x)).length;
  return `<div class="legend">${tag('sun', 'GC root')}${tag('lilac', lu('reach'))}${tag('dead', lu('unreach'))}${st.phase === 'mark' ? tag('mint', lu('marked')) : ''}<b class="legend-n">${esc(ls$('deadN', dead))}</b></div>`;
}
/* Generational heap: a teaching model with small regions so that aging is visible in a few clicks. */
const GEN = {eden:6, surv:3, old:6, tenure:3};
function genNew() { return {eden:[], s:[[], []], from:0, old:[], n:0, minor:0, full:0, msg:['ready'], oom:false}; }
function genAlloc(g) {
  if (g.eden.length >= GEN.eden) genMinor(g);
  if (g.eden.length >= GEN.eden) { g.oom = true; g.msg = ['oom']; return; }
  g.n++; g.eden.push({id:g.n, age:0, live:true}); if (!g.oom) g.msg = ['alloc', g.n];
}
function genMinor(g) {
  g.minor++;
  const to = 1 - g.from, moved = [...g.eden, ...g.s[g.from]].filter(o => o.live);
  const freed = g.eden.length + g.s[g.from].length - moved.length;
  g.eden = []; g.s[g.from] = []; g.s[to] = [];
  let promoted = 0;
  for (const o of moved) {
    o.age++;
    if (o.age >= GEN.tenure || g.s[to].length >= GEN.surv) {
      if (g.old.length >= GEN.old) genFull(g);
      if (g.old.length >= GEN.old) { g.oom = true; g.msg = ['oom']; continue; }
      g.old.push(o); promoted++;
    } else g.s[to].push(o);
  }
  g.from = to;
  if (!g.oom) g.msg = ['minor', freed, promoted];
}
function genFull(g) {
  g.full++;
  const before = g.old.length + g.eden.length + g.s[0].length + g.s[1].length;
  g.old = g.old.filter(o => o.live); g.eden = g.eden.filter(o => o.live);
  g.s = g.s.map(x => x.filter(o => o.live));
  g.msg = ['full', before - (g.old.length + g.eden.length + g.s[0].length + g.s[1].length)];
  g.oom = false;
}
function genChip(o) {
  return `<button class="gchip${o.live ? '' : ' dead'}" type="button" data-act="toggle" data-v="${o.id}" aria-pressed="${o.live}" title="${esc(o.live ? lu('dropRef') : lu('restoreRef'))}"><b>#${o.id}</b><small>age ${o.age}</small></button>`;
}
function genRegion(name, items, cap, cls) {
  const empty = Array.from({length:Math.max(0, cap - items.length)}, () => '<span class="gslot"></span>').join('');
  return `<div class="greg ${cls}"><h3>${esc(name)} <small>${items.length} / ${cap}</small></h3><div class="gcells">${items.map(genChip).join('')}${empty}</div></div>`;
}
function genStage(g) {
  return pnl(lu('heapTitle'), `<div class="gheap"><div class="gyoung"><h4>Young</h4><div class="gyoung-in">${genRegion('Eden', g.eden, GEN.eden, 'r-eden')}${genRegion('Survivor ' + (g.from === 0 ? '0 (from)' : '0 (to)'), g.s[0], GEN.surv, 'r-s')}${genRegion('Survivor ' + (g.from === 1 ? '1 (from)' : '1 (to)'), g.s[1], GEN.surv, 'r-s')}</div></div><div class="gold"><h4>Old</h4>${genRegion('Tenured', g.old, GEN.old, 'r-old')}</div></div>
    <div class="gtext"><span><code>Minor GC</code> <b>${g.minor}</b></span><span><code>Full GC</code> <b>${g.full}</b></span></div>
    <p class="explain-s${g.oom ? ' err' : ''}">${rich(ls$(g.msg[0], ...g.msg.slice(1)))}</p>`)
  + pnl(lu('realLog'), `<pre class="logv">[gc,age] GC(1) - age   1:  131104 bytes
[gc,age] GC(1) - age   2:  201056 bytes
[gc    ] GC(1) Pause Young (Allocation Failure) 7M-&gt;1M(31M) 0.096ms</pre><p class="muted">${rich(lu('realLogText'))}</p>${simplified(rich(lu('genModel')))}`);
}
const GC_COLLECTORS = {
  az:[['Serial','Bir thread işlədir. Kiçik heap və kiçik maşınlar üçün.','-XX:+UseSerialGC'],['Parallel','Bir neçə thread işlədir, ümumi throughput-a baxır.','-XX:+UseParallelGC'],['G1','Heap-i region-lara bölür, pause-u qısa saxlamağa çalışır. Bu ölçüdə default-dur.','-XX:+UseG1GC'],['ZGC','Pause çox qısadır, işin çoxu application ilə paralel gedir. Böyük heap üçün.','-XX:+UseZGC'],['Shenandoah','Pause-u qısa saxlayır, heap ölçüsündən az asılıdır. Hər JDK build-ində olmur.','-XX:+UseShenandoahGC']],
  tr:[['Serial',"Tek thread kullanır. Küçük heap ve küçük makineler için.",'-XX:+UseSerialGC'],['Parallel',"Birden fazla thread kullanır, toplam throughput'a bakar.",'-XX:+UseParallelGC'],['G1',"Heap'i region'lara böler, pause'u kısa tutmaya çalışır. Bu ölçümde default'tur.",'-XX:+UseG1GC'],['ZGC',"Pause çok kısadır, işin çoğu application ile paralel yürür. Büyük heap için.",'-XX:+UseZGC'],['Shenandoah',"Pause'u kısa tutar, heap boyutuna az bağlıdır. Her JDK build'inde olmaz.",'-XX:+UseShenandoahGC']],
  en:[['Serial','Uses one thread. For small heaps and small machines.','-XX:+UseSerialGC'],['Parallel','Uses several threads and aims for total throughput.','-XX:+UseParallelGC'],['G1','Splits the heap into regions and aims for short pauses. The default in this measurement.','-XX:+UseG1GC'],['ZGC','Very short pauses, because most work runs alongside the application. For large heaps.','-XX:+UseZGC'],['Shenandoah','Short pauses that depend little on heap size. Not in every JDK build.','-XX:+UseShenandoahGC']],
};
LS.gc = {
  init(i) { if (i === 2) { const g = genNew(); for (let k = 0; k < 4; k++) genAlloc(g); g.eden[1].live = false; g.eden[3].live = false; g.msg = ['ready']; return {g}; } return {i:0}; },
  controls(st, ch) {
    if (GC_SCRIPTS[ch]) return lsStepper(st.i, GC_SCRIPTS[ch].steps.length);
    if (ch === 2) return `<div class="stepbar"><button class="btn primary" type="button" data-act="new"><code class="bare">new</code></button><button class="btn" type="button" data-act="minor">Minor GC</button><button class="btn" type="button" data-act="full">Full GC</button><button class="btn ghost" type="button" data-act="reset">${esc(LS_UI[LANG].reset)}</button></div>`;
    return '';
  },
  stage(st, ch) {
    if (GC_SCRIPTS[ch]) {
      const sc = GC_SCRIPTS[ch], r = gcReplay(sc, st.i), caps = lsX().ch[ch][2];
      const last = st.i ? sc.steps[st.i - 1][0] : -1;
      return pnl(lu('graph'), gcGraph(sc, r) + gcLegend(r, sc) + `<p class="explain-s">${rich(st.i ? caps[st.i - 1] : lu('pressNext'))}</p>`)
        + pnl(LS_UI[LANG].code, codeBlock(sc.code, last))
        + (ch === 1 || ch === 3 ? pnl('', measured(rich(ch === 1 ? lu('mCycle') : lu('mLeak')))) : '');
    }
    if (ch === 2) return genStage(st.g);
    return pnl(lu('collectors'), `<table class="demo"><thead><tr><th>GC</th><th>${esc(lu('colWhat'))}</th><th>${esc(lu('colFlag'))}</th></tr></thead><tbody>${GC_COLLECTORS[LANG].map(r => `<tr><td><b>${r[0]}</b></td><td>${esc(nb(r[1]))}</td><td><code>${r[2]}</code></td></tr>`).join('')}</tbody></table>`)
      + pnl('', measured(rich(lu('mDefaults'))));
  },
  act(st, a, v, ch) {
    if (GC_SCRIPTS[ch]) { const n = GC_SCRIPTS[ch].steps.length; if (a === 'next') st.i = Math.min(n, st.i + 1); if (a === 'prev') st.i = Math.max(0, st.i - 1); if (a === 'reset') st.i = 0; return; }
    if (ch === 2) {
      const g = st.g;
      if (a === 'new') genAlloc(g);
      if (a === 'minor') genMinor(g);
      if (a === 'full') genFull(g);
      if (a === 'reset') Object.assign(st, LS.gc.init(2));
      if (a === 'toggle') { for (const o of [...g.eden, ...g.s[0], ...g.s[1], ...g.old]) if (o.id === +v) { o.live = !o.live; g.msg = [o.live ? 'restored' : 'dropped', o.id]; } }
    }
  },
  text: {
    az: {title:'Garbage Collection', door:'Object nə vaxt silinir? GC root-ları, mark-sweep, Eden, Survivor, Old və memory leak.',
      ui:{reach:'reachable', unreach:'GC silə bilər', marked:'marked', deadN:n => n ? `${n} object GC üçün uyğundur` : 'Hamısı reachable-dır', graph:'Reference-lər', pressNext:'Növbəti düyməsini bas.',
        heapTitle:'Heap', realLog:'Real GC log-u', realLogText:'Bu sətirlər `-Xlog:gc+age=trace,gc` ilə işləyən JDK 21-dən götürülüb. Sağ qalan object-lərin `age`-i hər Minor GC-də artır.',
        genModel:'Region-lar kiçikdir və `age` 3-də Old-a keçir ki, bir neçə kliklə görünsün. Real `MaxTenuringThreshold` default olaraq 15-dir və JVM onu özü azalda bilər. G1 isə heap-i region-larla idarə edir, amma məntiq eynidir.',
        dropRef:'Reference-i sil', restoreRef:'Reference-i qaytar', ready:'`new` ilə object yarat. Object-ə klik etsən, reference-i silinir.', alloc:n => `#${n} Eden-də yarandı.`, minor:(f, p) => `Minor GC: ${f} ölü object silindi, sağ qalanlar köçürüldü${p ? `, ${p} object Old-a keçdi` : ''}.`, full:n => `Full GC: bütün heap yoxlandı, ${n} object silindi.`, oom:'`OutOfMemoryError`: GC yer aça bilmədi, çünki object-lərin hamısına reference var. Object-lərə klik et, sonra Full GC bas.', dropped:n => `#${n}-ə reference qalmadı. GC-yə qədər yerində qalır.`, restored:n => `#${n}-ə reference qaytarıldı.`,
        collectors:'Əsas collector-lar', colWhat:'Nə edir', colFlag:'Seçim',
        mCycle:'`WeakReference` ilə yoxlandı: cycle-dakı object-lər `System.gc()`-dən sonra silindi.', mLeak:'`WeakReference` ilə yoxlandı: `static` list-də qalan object silinmədi, `clear()`-dən sonra silindi.',
        mDefaults:'Bu Mac-də JDK 21-in default-ları: `UseG1GC = true`, `MaxTenuringThreshold = 15`, `SurvivorRatio = 8`, `NewRatio = 2`. JVM collector-u maşına görə seçir, kiçik maşında Serial seçə bilər.'},
      ch:[
        ['Object nə vaxt silinir?', ['GC object-in lazım olub-olmadığını bilmir. Yalnız bir suala cavab axtarır: GC root-lardan bu object-ə reference yolu ilə çatmaq olurmu?', 'GC root-lar: stack-dəki local variable-lar, `static` field-lər və işləyən thread-lər. Çatılan object `reachable`-dır və qalır.', 'Sağda addımla: reference-lər kəsildikcə object-in vəziyyəti dəyişir.'],
          ['`o` yeni `Order` object-inə baxır. O, reachable-dır.','`c` yeni `Customer` object-inə baxır.','`Order` field-i də `Customer`-ə baxır. İndi ona iki yol var.','`c` silindi, amma `Customer` qalır: `o.customer` yolu hələ var.','Root-dan yol qalmadı. Hər iki object GC üçün uyğundur, amma dərhal silinmir, növbəti GC-ni gözləyir.']],
        ['Cycle və mark-sweep', ['Bir-birinə baxan iki object silinə bilərmi? Reference counting olsaydı, silinməzdi. Java reference saymır, root-lardan başlayır, ona görə cycle problem deyil.', 'Mark: GC root-lardan gəzib çatdığı object-ləri işarələyir. Sweep: işarəsiz object-lərin yerini boşaldır. Compact mərhələsi isə qalanları sıxlaşdırır.', 'Mərhələlərin bir hissəsi işləyərkən application dayana bilər. Buna stop-the-world pause deyilir.'],
          ['`x` yeni `Node`-a baxır.','`y` ikinci `Node`-a baxır.','Birinci ikinciyə baxır.','İkinci birinciyə baxır: cycle yarandı.','`x` silindi. Birinci hələ reachable-dır, çünki `y` → ikinci → birinci yolu var.','`y` də silindi. Object-lər hələ bir-birinə baxır, amma root-dan yol yoxdur.','Mark: GC root-lardan başladı və heç bir object-ə çatmadı, heç nə işarələnmədi.','Sweep: işarəsiz hər iki object silindi. Cycle mane olmadı. `System.gc()` isə yalnız xahişdir, JVM onu nəzərə almaya da bilər.']],
        ['Eden, Survivor və Old', ['Çox object tez ölür, ona görə heap nəsillərə bölünür. Yeni object Eden-də yaranır. Eden dolanda Minor GC işləyir.', 'Minor GC yalnız sağ qalanları köçürür: Survivor-a keçir, `age` 1 artır. Eyni vaxtda bir Survivor həmişə boşdur. `age` limitə çatanda object Old-a keçir.', 'Old daha nadir yoxlanır. Yoxla: `new` bas, object-lərə klik edib reference-ini sil, sonra Minor GC bas. Old-da ölü object Minor GC ilə silinmir, onun üçün Full GC lazımdır.']],
        ['Memory leak Java-da necə olur?', ['GC var, amma leak yenə olur: lazım olmayan object-ə reference qalıbsa, GC onu silə bilməz. GC üçün o, hələ reachable-dır.', 'Ən çox görülən hal `static` collection-dır, sonra bağlanmayan listener-lər və limitsiz cache-lər. Heap dolanda `OutOfMemoryError` gəlir.', 'Həll reference-i silməkdir: `remove`, `clear`, limitli cache və ya `WeakReference`.'],
          ['`static` field root-dur. `ArrayList`-ə həmişə yol var.','`o` yeni `Order`-ə baxır.','List də eyni object-ə reference saxlayır.','`o = null` kifayət etmir: `Order` hələ list-in içindən reachable-dır. Leak budur.','`clear()` list-in array-indəki reference-i sildi. `Order` indi GC üçün uyğundur.']],
        ['Collector seçimi', ['Hamısı reachable object-ləri tapır, fərq nə vaxt və necə işləməsindədir. Pause qısa olsun, yoxsa ümumi iş çox olsun? Adətən ikisi birdən ən yaxşı olmur.', 'Çox vaxt default-u dəyişmək lazım deyil. Əvvəl `-Xlog:gc` ilə ölç, sonra qərar ver.', 'Tələ: `finalize()` deprecated-dir, resurs bağlamaq üçün `try-with-resources` işlət.']],
      ]},
    tr: {title:'Garbage Collection', door:"Object ne zaman silinir? GC root'ları, mark-sweep, Eden, Survivor, Old ve memory leak.",
      ui:{reach:'reachable', unreach:'GC silebilir', marked:'marked', deadN:n => n ? `${n} object GC için uygun` : 'Hepsi reachable', graph:"Reference'lar", pressNext:'Sonraki düğmesine bas.',
        heapTitle:'Heap', realLog:'Gerçek GC log', realLogText:"Bu satırlar `-Xlog:gc+age=trace,gc` ile çalışan JDK 21'den alındı. Hayatta kalan object'lerin `age` değeri her Minor GC'de artar.",
        genModel:"Region'lar küçük ve `age` 3'te Old'a geçilir ki birkaç tıkla görünsün. Gerçek `MaxTenuringThreshold` default olarak 15'tir ve JVM bunu kendisi düşürebilir. G1 heap'i region'larla yönetir, ama mantık aynıdır.",
        dropRef:"Reference'ı sil", restoreRef:"Reference'ı geri getir", ready:"`new` ile object oluştur. Object'e tıklarsan reference'ı silinir.", alloc:n => `#${n} Eden'de oluştu.`, minor:(f, p) => `Minor GC: ${f} ölü object silindi, hayatta kalanlar taşındı${p ? `, ${p} object Old'a geçti` : ''}.`, full:n => `Full GC: tüm heap kontrol edildi, ${n} object silindi.`, oom:"`OutOfMemoryError`: GC yer açamadı, çünkü tüm object'lere reference var. Object'lere tıkla, sonra Full GC'ye bas.", dropped:n => `#${n} için reference kalmadı. GC'ye kadar yerinde durur.`, restored:n => `#${n} için reference geri geldi.`,
        collectors:"Temel collector'lar", colWhat:'Ne yapar', colFlag:'Seçim',
        mCycle:"`WeakReference` ile kontrol edildi: cycle içindeki object'ler `System.gc()` sonrası silindi.", mLeak:"`WeakReference` ile kontrol edildi: `static` list'te kalan object silinmedi, `clear()` sonrası silindi.",
        mDefaults:"Bu Mac'te JDK 21 default'ları: `UseG1GC = true`, `MaxTenuringThreshold = 15`, `SurvivorRatio = 8`, `NewRatio = 2`. JVM collector'ı makineye göre seçer, küçük makinede Serial seçebilir."},
      ch:[
        ['Object ne zaman silinir?', ["GC bir object'in gerekli olup olmadığını bilmez. Tek bir soruya bakar: GC root'lardan bu object'e reference yoluyla ulaşılıyor mu?", "GC root'lar: stack'teki local variable'lar, `static` field'lar ve çalışan thread'ler. Ulaşılan object `reachable` olur ve kalır.", "Sağda adım adım ilerle: reference'lar kesildikçe object'in durumu değişir."],
          ['`o` yeni `Order` object\'ine bakıyor. Reachable.','`c` yeni `Customer` object\'ine bakıyor.',"`Order` field'ı da `Customer`'a bakıyor. Artık ona iki yol var.",'`c` silindi, ama `Customer` kalır: `o.customer` yolu hâlâ var.',"Root'tan yol kalmadı. İki object de GC için uygun, ama hemen silinmez, sonraki GC'yi bekler."]],
        ['Cycle ve mark-sweep', ["Birbirine bakan iki object silinebilir mi? Reference counting olsaydı silinmezdi. Java reference saymaz, root'lardan başlar, bu yüzden cycle sorun değildir.", "Mark: GC root'lardan gezip ulaştığı object'leri işaretler. Sweep: işaretsiz object'lerin yerini boşaltır. Compact aşaması da kalanları sıkıştırır.", "Bazı aşamalarda application durabilir. Buna stop-the-world pause denir."],
          ["`x` yeni `Node`'a bakıyor.","`y` ikinci `Node`'a bakıyor.","Birinci ikinciye bakıyor.","İkinci birinciye bakıyor: cycle oluştu.","`x` silindi. Birinci hâlâ reachable, çünkü `y` → ikinci → birinci yolu var.","`y` de silindi. Object'ler hâlâ birbirine bakıyor, ama root'tan yol yok.","Mark: GC root'lardan başladı, hiçbir object'e ulaşamadı, hiçbir şey işaretlenmedi.","Sweep: işaretsiz iki object de silindi. Cycle engel olmadı. `System.gc()` ise yalnızca istektir, JVM dikkate almayabilir."]],
        ['Eden, Survivor ve Old', ["Çoğu object çabuk ölür, bu yüzden heap nesillere bölünür. Yeni object Eden'de oluşur. Eden dolunca Minor GC çalışır.", "Minor GC yalnızca hayatta kalanları taşır: Survivor'a geçer, `age` 1 artar. Aynı anda bir Survivor her zaman boştur. `age` sınıra gelince object Old'a geçer.", "Old daha seyrek kontrol edilir. Dene: `new` bas, object'lere tıklayıp reference'ını sil, sonra Minor GC bas. Old'daki ölü object Minor GC ile silinmez, Full GC gerekir."]],
        ["Java'da memory leak nasıl olur?", ["GC var ama leak yine olur: gereksiz bir object'e reference kaldıysa GC onu silemez. GC için hâlâ reachable'dır.", "En sık görülen hal `static` collection'dır, sonra kapatılmayan listener'lar ve sınırsız cache'ler. Heap dolunca `OutOfMemoryError` gelir.", "Çözüm reference'ı silmektir: `remove`, `clear`, sınırlı cache veya `WeakReference`."],
          ["`static` field root'tur. `ArrayList`'e her zaman yol var.","`o` yeni `Order`'a bakıyor.","List de aynı object'e reference tutuyor.","`o = null` yetmez: `Order` hâlâ list içinden reachable. Leak budur.","`clear()` list'in array'indeki reference'ı sildi. `Order` artık GC için uygun."]],
        ['Collector seçimi', ["Hepsi reachable object'leri bulur, fark ne zaman ve nasıl çalıştıklarındadır. Pause mu kısa olsun, toplam iş mi çok olsun? Genellikle ikisi birden en iyi olmaz.", "Çoğu zaman default'u değiştirmek gerekmez. Önce `-Xlog:gc` ile ölç, sonra karar ver.", "Tuzak: `finalize()` deprecated'dır, kaynak kapatmak için `try-with-resources` kullan."]],
      ]},
    en: {title:'Garbage Collection', door:'When is an object removed? GC roots, mark-sweep, Eden, Survivor, Old and memory leaks.',
      ui:{reach:'reachable', unreach:'GC can remove', marked:'marked', deadN:n => n ? `${n} object${n > 1 ? 's' : ''} eligible for GC` : 'All reachable', graph:'References', pressNext:'Press Next.',
        heapTitle:'Heap', realLog:'Real GC log', realLogText:'These lines come from JDK 21 running with `-Xlog:gc+age=trace,gc`. The `age` of surviving objects grows with every Minor GC.',
        genModel:'Regions are small and objects move to Old at `age` 3, so it shows in a few clicks. The real `MaxTenuringThreshold` defaults to 15 and the JVM may lower it. G1 manages the heap in regions, but the idea is the same.',
        dropRef:'Remove the reference', restoreRef:'Restore the reference', ready:'Create objects with `new`. Click an object to remove its reference.', alloc:n => `#${n} was created in Eden.`, minor:(f, p) => `Minor GC: ${f} dead object${f === 1 ? '' : 's'} removed, survivors copied${p ? `, ${p} moved to Old` : ''}.`, full:n => `Full GC: the whole heap was checked, ${n} object${n === 1 ? '' : 's'} removed.`, oom:'`OutOfMemoryError`: GC could not free space because every object still has a reference. Click objects, then press Full GC.', dropped:n => `#${n} has no reference now. It stays until the next GC.`, restored:n => `#${n} has its reference back.`,
        collectors:'Main collectors', colWhat:'What it does', colFlag:'Option',
        mCycle:'Checked with `WeakReference`: the objects in the cycle were removed after `System.gc()`.', mLeak:'Checked with `WeakReference`: the object in the `static` list stayed, and was removed after `clear()`.',
        mDefaults:'JDK 21 defaults on this Mac: `UseG1GC = true`, `MaxTenuringThreshold = 15`, `SurvivorRatio = 8`, `NewRatio = 2`. The JVM picks the collector by machine and may pick Serial on a small one.'},
      ch:[
        ['When is an object removed?', ['GC does not know whether an object is needed. It asks one question: can this object be reached through references from a GC root?', 'GC roots are local variables on the stack, `static` fields and running threads. A reached object is `reachable` and stays.', 'Step through on the right: the state changes as references are cut.'],
          ['`o` refers to a new `Order`. It is reachable.','`c` refers to a new `Customer`.','A field of `Order` also refers to `Customer`. There are now two paths to it.','`c` is gone, but `Customer` stays: the path through `o.customer` remains.','No path from a root is left. Both objects are eligible for GC, but they are not removed at once: they wait for the next GC.']],
        ['Cycles and mark-sweep', ['Can two objects that refer to each other be removed? With reference counting they could not. Java does not count references: it starts from the roots, so a cycle is no problem.', 'Mark: GC walks from the roots and marks what it reaches. Sweep: it frees the space of unmarked objects. A compact phase then packs the rest together.', 'During some phases the application can stop. This is called a stop-the-world pause.'],
          ['`x` refers to a new `Node`.','`y` refers to a second `Node`.','The first refers to the second.','The second refers to the first: a cycle.','`x` is gone. The first is still reachable through `y` → second → first.','`y` is gone too. The objects still refer to each other, but no root reaches them.','Mark: GC started at the roots, reached no object and marked nothing.','Sweep: both unmarked objects are removed. The cycle did not stop it. `System.gc()` is only a request, and the JVM may ignore it.']],
        ['Eden, Survivor and Old', ['Most objects die young, so the heap is split into generations. A new object starts in Eden. When Eden fills up, a Minor GC runs.', 'Minor GC copies only the survivors: they move to Survivor and `age` grows by 1. One Survivor is always empty. When `age` reaches the limit, the object moves to Old.', 'Old is checked less often. Try it: press `new`, click objects to remove their reference, then press Minor GC. A dead object in Old is not removed by Minor GC: it needs a Full GC.']],
        ['How does a memory leak happen in Java?', ['GC exists, yet leaks still happen: if a reference to an unneeded object remains, GC cannot remove it. To GC it is still reachable.', 'The most common case is a `static` collection, then listeners that are never removed and unbounded caches. When the heap fills up you get `OutOfMemoryError`.', 'The fix is to remove the reference: `remove`, `clear`, a bounded cache or `WeakReference`.'],
          ['A `static` field is a root. `ArrayList` can always be reached.','`o` refers to a new `Order`.','The list also keeps a reference to that object.','`o = null` is not enough: `Order` is still reachable through the list. This is the leak.','`clear()` removed the reference from the array of the list. `Order` is now eligible for GC.']],
        ['Choosing a collector', ['All of them find reachable objects. They differ in when and how they work. Short pauses or more total work? Usually you cannot have the best of both.', 'Most of the time the default is fine. Measure with `-Xlog:gc` first, then decide.', 'Trap: `finalize()` is deprecated. Use `try-with-resources` to close resources.']],
      ]},
  },
};
