/* ---------- Class loading: scripted traces, each compared with a real java run ---------- */
const CL_ORDER_SRC = ['class P {', '  static int ps = log("P static field");', '  int pf = log("P instance field");', '  static { log("P static block"); }', '  { log("P instance block"); }', '  P() { log("P constructor"); }', '  static int log(String s) { System.out.println(s); return 1; }', '}', 'class C extends P {', '  static int cs = log("C static field");', '  int cf = log("C instance field");', '  static { log("C static block"); }', '  { log("C instance block"); }', '  C() { log("C constructor"); }', '}', 'public class Main {', '  public static void main(String[] a) {', '    new C();', '    new C();', '  }', '}'];
const CL_INST = [[2, 'P instance field', 'if', 'P'], [4, 'P instance block', 'ib', 'P'], [5, 'P constructor', 'ct', 'P'], [10, 'C instance field', 'if', 'C'], [12, 'C instance block', 'ib', 'C'], [13, 'C constructor', 'ct', 'C']];
const clS = (l, p, k, c, set) => ({l, p, k, c, set});
const CL_SCRIPT = {
  1: {src:['class K {', '  static int z = 7;', '  static final int X = 5;', '  static { System.out.println("K init"); }', '}', 'public class Main {', '  public static void main(String[] a) {', '    System.out.println(K.z);', '  }', '}'],
      cls:['K'], fields:['K.X', 'K.z'],
      steps:[clS(7, null, 'phLoad', 'K', {K:'loaded'}), clS(0, null, 'phVerify', 'K', {K:'linked', phase:1}), clS(1, null, 'phPrepare', 'K', {'K.z':'0', 'K.X':'5', phase:2}), clS(1, null, 'phResolve', 'K', {phase:3}), clS(1, null, 'phInit', 'K', {'K.z':'7', phase:4}), clS(3, 'K init', 'sb', 'K', {K:'init', phase:4}), clS(7, '7', 'use', 'K', {})]},
  2: {src:CL_ORDER_SRC, cls:['P', 'C'], fields:[],
      steps:[clS(17, null, 'needParent', 'C', {P:'loaded', C:'loaded'}), clS(1, 'P static field', 'sf', 'P', {}), clS(3, 'P static block', 'sb', 'P', {P:'init'}), clS(9, 'C static field', 'sf', 'C', {}), clS(11, 'C static block', 'sb', 'C', {C:'init'}), clS(13, null, 'super', 'C', {}), ...CL_INST.map(x => clS(x[0], x[1], x[2], x[3], {})), clS(18, null, 'noStatic', 'C', {}), ...CL_INST.map(x => clS(x[0], x[1], x[2], x[3], {}))]},
  3: {src:['class P {', '  P() { hello(); }', '  void hello() { }', '}', 'class C extends P {', '  String name = "Aysel";', '  @Override void hello() { System.out.println("name=" + name); }', '}', 'public class Main {', '  public static void main(String[] a) {', '    C c = new C();', '    c.hello();', '  }', '}'],
      cls:['P', 'C'], fields:['c.name'],
      steps:[clS(10, null, 'alloc', 'C', {P:'init', C:'init', 'c.name':'null'}), clS(1, null, 'pCtor', 'P', {}), clS(6, 'name=null', 'virt', 'C', {}), clS(5, null, 'if', 'C', {'c.name':'"Aysel"'}), clS(11, 'name=Aysel', 'after', 'C', {})]},
  4: {src:['class K {', '  static final int X = 5;', '  static final Integer Y = 6;', '  static { System.out.println("K init"); }', '}', 'class Par {', '  static int v = 1;', '  static { System.out.println("Par init"); }', '}', 'class Ch extends Par {', '  static { System.out.println("Ch init"); }', '}', 'public class Main {', '  public static void main(String[] a) {', '    System.out.println(K.X);', '    System.out.println(K.Y);', '    System.out.println(Ch.v);', '    Ch[] arr = new Ch[2];', '    System.out.println("end");', '  }', '}'],
      cls:['K', 'Par', 'Ch'], fields:[],
      steps:[clS(14, '5', 'constant', 'K', {}), clS(3, 'K init', 'notConst', 'K', {K:'init'}), clS(15, '6', 'use', 'K', {}), clS(7, 'Par init', 'parentOnly', 'Par', {Par:'init'}), clS(16, '1', 'use', 'Par', {}), clS(17, null, 'arrayNo', 'Ch', {}), clS(18, 'end', 'childNever', 'Ch', {})]},
  5: {src:['class Ord {', '  static int a = b();', '  static int c = 10;', '  static int b() { return c; }', '}', 'class Boom {', '  static int v = 1 / 0;', '}', 'public class Main {', '  public static void main(String[] x) {', '    System.out.println(Ord.a);', '    System.out.println(Ord.c);', '    for (int i = 0; i < 2; i++) {', '      try { System.out.println(Boom.v); }', '      catch (Throwable t) { System.out.println(t.getClass().getSimpleName()); }', '    }', '  }', '}'],
      cls:['Ord', 'Boom'], fields:['Ord.a', 'Ord.c'],
      steps:[clS(10, null, 'prep2', 'Ord', {'Ord.a':'0', 'Ord.c':'0'}), clS(1, null, 'readEarly', 'Ord', {'Ord.a':'0'}), clS(2, null, 'sf', 'Ord', {'Ord.c':'10', Ord:'init'}), clS(10, '0', 'use', 'Ord', {}), clS(11, '10', 'use', 'Ord', {}), clS(13, 'ExceptionInInitializerError', 'boom1', 'Boom', {Boom:'failed'}), clS(13, 'NoClassDefFoundError', 'boom2', 'Boom', {})]},
};
const CL_CLASSES = {
  String:{name:'java.lang.String', at:0},
  Connection:{name:'java.sql.Connection', at:1},
  Main:{name:'Main', at:2},
};
const CL_LOADERS = ['Bootstrap', 'Platform', 'Application'];
function clDelegation(cn) {
  const c = CL_CLASSES[cn], s = [{at:2, dir:'ask'}, {at:1, dir:'up'}, {at:0, dir:'up'}];
  for (let i = 0; i < c.at; i++) s.push({at:i + 1, dir:'down', miss:i});
  s.push({at:c.at, dir:'found'});
  return s;
}
function clReplay(sc, upto) {
  const st = {cls:{}, f:{}, phase:-1, out:[]};
  for (let i = 0; i < upto; i++) { const s = sc.steps[i]; Object.entries(s.set).forEach(([k, v]) => { if (k === 'phase') st.phase = v; else if (k.includes('.')) st.f[k] = v; else st.cls[k] = v; }); if (s.p !== null) st.out.push(s.p); }
  return st;
}
const CL_PH = ['Loading', 'Verification', 'Preparation', 'Resolution', 'Initialization'];
LS.classload = {
  init(i) { return i === 0 ? {i:0, c:'Main'} : {i:0}; },
  controls(st, ch) {
    if (ch === 0) return lsStepper(st.i, clDelegation(st.c).length, `<div class="seg" role="group">${Object.keys(CL_CLASSES).map(k => `<button class="btn${st.c === k ? ' sel' : ''}" type="button" data-act="cls" data-v="${k}" aria-pressed="${st.c === k}"><code class="bare">${k}</code></button>`).join('')}</div>`);
    return lsStepper(st.i, CL_SCRIPT[ch].steps.length);
  },
  stage(st, ch) {
    if (ch === 0) {
      const steps = clDelegation(st.c), cur = st.i ? steps[st.i - 1] : null, c = CL_CLASSES[st.c];
      const row = CL_LOADERS.map((n, i) => `<div class="clbox${cur && cur.at === i ? ' on' : ''}${cur && cur.dir === 'found' && cur.at === i ? ' found' : ''}"><h3>${n} ClassLoader</h3><p class="muted small">${esc(lu('ldr')[i])}</p></div>`).join('<span class="clarrow" aria-hidden="true">⇅</span>');
      const cap = !cur ? lu('pressNext') : ls$('d_' + cur.dir, CL_LOADERS[cur.at], c.name, cur.miss !== undefined ? CL_LOADERS[cur.miss] : '');
      return pnl(lu('delegation'), `<p class="pipekey"><b>${esc(c.name)}</b></p><div class="clstack">${row}</div><p class="explain-s">${rich(cap)}</p>`)
        + pnl('', measured(rich(lu('mLoad'))));
    }
    const sc = CL_SCRIPT[ch], r = clReplay(sc, st.i), s = st.i ? sc.steps[st.i - 1] : null;
    const phases = ch === 1 ? `<div class="phases">${CL_PH.map((p, i) => `<span class="ph${r.phase === i ? ' on' : r.phase > i ? ' done' : ''}${i >= 1 && i <= 3 ? ' link' : ''}">${p}</span>`).join('')}</div><p class="muted small">${rich(lu('linkNote'))}</p>` : '';
    const cards = sc.cls.map(c => { const v = r.cls[c] || 'none'; return `<span class="cls cls-${v}"><code class="bare">${c}</code> ${esc(lu('st')[v])}</span>`; }).join('');
    const fields = sc.fields.length ? `<div class="clf">${sc.fields.map(f => `<span class="thvar"><code class="bare">${f}</code><i class="val">${esc(r.f[f] || '-')}</i></span>`).join('')}</div>` : '';
    const cap = s ? ls$('c_' + s.k, s.c) : lu('pressNext');
    return `<div class="bcgrid">${pnl(LS_UI[LANG].code, codeBlock(sc.src, s ? s.l : -1))}${pnl(LS_UI[LANG].out, `<pre class="logv outv">${esc(r.out.join('\n')) || ' '}</pre>`)}</div>`
      + pnl(lu('classes'), phases + `<div class="clsrow">${cards}</div>${fields}<p class="explain-s">${rich(cap)}</p>`)
      + pnl('', measured(rich(lu('mOut'))));
  },
  act(st, a, v, ch) {
    const n = ch === 0 ? clDelegation(st.c).length : CL_SCRIPT[ch].steps.length;
    if (a === 'next') st.i = Math.min(n, st.i + 1);
    if (a === 'prev') st.i = Math.max(0, st.i - 1);
    if (a === 'reset') st.i = 0;
    if (a === 'cls') { st.c = v; st.i = 0; }
  },
  text: {
    az: {title:'Class loading', door:'Class nə vaxt yüklənir? Delegation, üç mərhələ, static və constructor sırası, klassik tələlər.',
      ui:{delegation:'Parent delegation', pressNext:'Növbəti düyməsini bas.', ldr:['JDK-nın əsas class-ları: java.lang və s.', 'JDK-nın əlavə modulları: java.sql və s.', 'Sənin kodun, classpath'],
        d_ask:(l, c) => `Kod \`${c}\` istəyir. Sorğu ${l} ClassLoader-ə gəlir.`, d_up:l => `Özü yükləmir, əvvəl parent-ə verir: ${l}.`, d_down:(l, c, m) => `${m} tapmadı. Sorğu ${l}-a qayıdır.`, d_found:(l, c) => `${l} tapdı və yüklədi: \`${c}\`.`,
        mLoad:'`String.class.getClassLoader()` `null` qaytardı, çünki Bootstrap Java object-i deyil. `java.sql.Connection`: PlatformClassLoader. Öz class-ımız: AppClassLoader.',
        mOut:'Sağdakı çıxış bu kodun real `java` ilə işlədilən nəticəsidir.', classes:'Class-ların vəziyyəti', linkNote:'Ortadakı üç mərhələ birlikdə Linking adlanır. Resolution lazy ola bilər.',
        st:{none:'yüklənməyib', loaded:'yükləndi', linked:'linked', init:'initialized', failed:'xəta ilə bitdi'},
        c_phLoad:c => `Loading: \`${c}.class\` oxunur, method area-da class məlumatı yaranır.`, c_phVerify:() => 'Verification: bytecode-un təhlükəsiz olduğu yoxlanır.', c_phPrepare:() => 'Preparation: static field-lər default dəyər alır, `z = 0`. Sabit `X` isə artıq 5-dir: `ConstantValue`-dan gəlir.', c_phResolve:() => 'Resolution: simvolik reference-lər real ünvanlara çevrilir.', c_phInit:() => 'Initialization: `<clinit>` işləyir və `z` indi 7-dir.',
        c_needParent:c => `\`new ${c}()\`: əvvəl parent class hazır olmalıdır.`, c_sf:c => `\`${c}\`-in static field-i işləyir.`, c_sb:c => `\`${c}\`-in static bloku işləyir.`, c_if:c => `\`${c}\`-in instance field-i işləyir.`, c_ib:c => `\`${c}\`-in instance bloku işləyir.`, c_ct:c => `\`${c}\` constructor-unun gövdəsi işləyir.`, c_super:() => 'Constructor-un ilk işi `super()` çağırmaqdır: əvvəl `P` hissəsi qurulur.', c_noStatic:() => 'İkinci `new C()`: static hissə təkrar işləmir, yalnız instance hissəsi işləyir.', c_use:() => 'Dəyər istifadə olunur.',
        c_alloc:() => 'Object yaradıldı. Field-lər default dəyərdədir: `name = null`.', c_pCtor:() => '`P` constructor-u işləyir, `C`-nin field-ləri hələ set olunmayıb.', c_virt:() => 'Method virtual-dır: `C.hello` çağırılır və `name` hələ `null`-dur.', c_after:() => 'Object tam qurulub, indi `name` görünür.',
        c_constant:() => '`K.X` compile-time constant-dır: dəyər `Main`-in içinə köçürülüb, `K` initialize olunmur.', c_notConst:() => '`Integer Y` constant deyil: `K` initialize olunur.', c_parentOnly:() => 'Field `Par`-dadır: yalnız `Par` initialize olunur, `Ch` olunmur.', c_arrayNo:() => 'Array yaratmaq `Ch`-ni initialize etmir.', c_childNever:() => '`Ch init` heç çap olunmadı.',
        c_prep2:() => 'Preparation: `a = 0`, `c = 0`.', c_readEarly:() => '`b()` işləyir və `c`-ni oxuyur: hələ 0-dır, sətir sırası vacibdir.', c_boom1:() => 'Birinci xəta: `<clinit>`-də exception oldu, `ExceptionInInitializerError` atıldı.', c_boom2:() => 'İkinci cəhd: class bir dəfəlik pozulub, indi `NoClassDefFoundError` gəlir.'},
      ch:[
        ['ClassLoader-lər və delegation', ['Class-ları üç əsas ClassLoader yükləyir. Hər biri əvvəl sorğunu parent-ə verir, parent tapmasa, özü axtarır.', 'Bunun sayəsində öz `java.lang.String` class-ını yazsan da, JDK-nınkı yüklənir.', 'Düymələrlə class seç və sorğunun yolunu izlə.']],
        ['Üç mərhələ', ['Class əvvəl yüklənir, sonra link olunur, sonra initialize olunur. Hər biri bir dəfə baş verir.', 'Preparation mərhələsində `static` field-lər default dəyər alır, sənin yazdığın dəyər isə yalnız Initialization mərhələsində gəlir.', 'JVM class-ı ilk real istifadəyə qədər initialize etmir.']],
        ['Static və constructor sırası', ['Bu sıranı müsahibələrdə çox soruşurlar: əvvəl static hissə, parent-dən child-a. Sonra hər `new` üçün instance hissəsi, yenə parent-dən child-a.', 'Bir class daxilində field-lər və bloklar yazılma sırası ilə işləyir. Constructor gövdəsi ən sondadır.', 'Çıxışın sətir-sətir necə yarandığını izlə.']],
        ['Constructor-da virtual method', ['`name` `"Aysel"` kimi yazılıb, amma ilk çıxış `name=null`-dur.', 'Parent constructor virtual method çağırır, Java isə child-ın versiyasını seçir. Bu anda child-ın field-ləri hələ set olunmayıb.', 'Qayda: constructor-da override oluna bilən method çağırma.']],
        ['Initialization nə vaxt olur?', ['Real istifadə tələb olunur: `new`, static method, constant olmayan static field.', '`static final int X = 5` compile-time constant-dır, dəyər compile zamanı köçürülür. `static final Integer Y` isə constant deyil.', 'Child adı ilə parent field-inə müraciət yalnız parent-i, array yaratmaq isə heç nəyi initialize etmir.']],
        ['İki tələ', ['Static field-lər sətir sırası ilə işləyir. `a` `c`-ni oxuyanda `c` hələ 0-dır, 10 yox.', '`<clinit>`-də exception olsa, class birdəfəlik sıradan çıxır: birinci dəfə `ExceptionInInitializerError`, sonra hər dəfə `NoClassDefFoundError`.', 'İkinci xəta əsl səbəbi gizlədir, ona görə log-da birinci xətanı axtar.']],
      ]},
    tr: {title:'Class loading', door:"Class ne zaman yüklenir? Delegation, üç aşama, static ve constructor sırası, klasik tuzaklar.",
      ui:{delegation:'Parent delegation', pressNext:'Sonraki düğmesine bas.', ldr:["JDK'nın temel class'ları: java.lang vb.", "JDK'nın ek modülleri: java.sql vb.", 'Senin kodun, classpath'],
        d_ask:(l, c) => `Kod \`${c}\` istiyor. Sorgu ${l} ClassLoader'a geliyor.`, d_up:l => `Kendisi yüklemez, önce parent'a verir: ${l}.`, d_down:(l, c, m) => `${m} bulamadı. Sorgu ${l} tarafına döner.`, d_found:(l, c) => `${l} buldu ve yükledi: \`${c}\`.`,
        mLoad:"`String.class.getClassLoader()` `null` döndürdü, çünkü Bootstrap bir Java object'i değildir. `java.sql.Connection`: PlatformClassLoader. Kendi class'ımız: AppClassLoader.",
        mOut:'Sağdaki çıktı bu kodun gerçek `java` ile çalıştırılmış sonucudur.', classes:"Class'ların durumu", linkNote:'Ortadaki üç aşama birlikte Linking diye adlandırılır. Resolution lazy olabilir.',
        st:{none:'yüklenmedi', loaded:'yüklendi', linked:'linked', init:'initialized', failed:'hatayla bitti'},
        c_phLoad:c => `Loading: \`${c}.class\` okunur, method area'da class bilgisi oluşur.`, c_phVerify:() => "Verification: bytecode'un güvenli olduğu kontrol edilir.", c_phPrepare:() => "Preparation: static field'lar default değer alır, `z = 0`. Sabit `X` ise zaten 5: `ConstantValue` üzerinden gelir.", c_phResolve:() => "Resolution: sembolik reference'lar gerçek adreslere çevrilir.", c_phInit:() => 'Initialization: `<clinit>` çalışır ve `z` artık 7.',
        c_needParent:c => `\`new ${c}()\`: önce parent class hazır olmalı.`, c_sf:c => `\`${c}\` static field çalışıyor.`, c_sb:c => `\`${c}\` static block çalışıyor.`, c_if:c => `\`${c}\` instance field çalışıyor.`, c_ib:c => `\`${c}\` instance block çalışıyor.`, c_ct:c => `\`${c}\` constructor gövdesi çalışıyor.`, c_super:() => "Constructor'ın ilk işi `super()` çağırmaktır: önce `P` kısmı kurulur.", c_noStatic:() => 'İkinci `new C()`: static kısım tekrar çalışmaz, yalnızca instance kısmı çalışır.', c_use:() => 'Değer kullanılıyor.',
        c_alloc:() => "Object oluştu. Field'lar default değerde: `name = null`.", c_pCtor:() => "`P` constructor çalışıyor, `C` field'ları henüz set edilmedi.", c_virt:() => 'Method virtual: `C.hello` çağrılır ve `name` hâlâ `null`.', c_after:() => 'Object tamamen kuruldu, şimdi `name` görünüyor.',
        c_constant:() => "`K.X` compile-time constant'tır: değer `Main` içine kopyalanır, `K` initialize olmaz.", c_notConst:() => '`Integer Y` constant değildir: `K` initialize olur.', c_parentOnly:() => "Field `Par` içinde: yalnızca `Par` initialize olur, `Ch` olmaz.", c_arrayNo:() => 'Array oluşturmak `Ch` için initialize yapmaz.', c_childNever:() => '`Ch init` hiç yazdırılmadı.',
        c_prep2:() => 'Preparation: `a = 0`, `c = 0`.', c_readEarly:() => '`b()` çalışır ve `c` okur: hâlâ 0, satır sırası önemlidir.', c_boom1:() => "İlk hata: `<clinit>` içinde exception oldu, `ExceptionInInitializerError` atıldı.", c_boom2:() => 'İkinci deneme: class bir kez bozuldu, şimdi `NoClassDefFoundError` gelir.'},
      ch:[
        ["ClassLoader'lar ve delegation", ["Class'ları üç temel ClassLoader yükler. Her biri önce sorguyu parent'a verir, parent bulamazsa kendisi arar.", "Bu sayede kendi `java.lang.String` class'ını yazsan da JDK'nınki yüklenir.", 'Düğmelerle class seç ve sorgunun yolunu izle.']],
        ['Üç aşama', ['Class önce yüklenir, sonra link edilir, sonra initialize edilir. Her biri bir kez olur.', "Preparation aşamasında `static` field'lar default değer alır, senin yazdığın değer ise yalnızca Initialization aşamasında gelir.", "JVM class'ı ilk gerçek kullanıma kadar initialize etmez."]],
        ['Static ve constructor sırası', ["Bu sıra mülakatlarda çok sorulur: önce static kısım, parent'tan child'a. Sonra her `new` için instance kısmı, yine parent'tan child'a.", "Bir class içinde field'lar ve block'lar yazılış sırasıyla çalışır. Constructor gövdesi en sondadır.", 'Çıktının satır satır nasıl oluştuğunu izle.']],
        ["Constructor'da virtual method", ['`name` `"Aysel"` olarak yazılmış, ama ilk çıktı `name=null`.', "Parent constructor virtual method çağırır, Java ise child'ın sürümünü seçer. Bu anda child'ın field'ları henüz set edilmemiştir.", "Kural: constructor içinde override edilebilir method çağırma."]],
        ['Initialization ne zaman olur?', ['Gerçek kullanım gerekir: `new`, static method, constant olmayan static field.', '`static final int X = 5` compile-time constant\'tır, değer compile sırasında kopyalanır. `static final Integer Y` ise constant değildir.', "Child adıyla parent field'ına erişmek yalnızca parent'ı initialize eder, array oluşturmak hiçbir şeyi etmez."]],
        ['İki tuzak', ["Static field'lar satır sırasıyla çalışır. `a`, `c` değerini okurken `c` hâlâ 0'dır, 10 değil.", "`<clinit>` içinde exception olursa class kalıcı olarak bozulur: ilk seferde `ExceptionInInitializerError`, sonra her seferde `NoClassDefFoundError`.", "İkinci hata asıl nedeni gizler, bu yüzden log'da ilk hatayı ara."]],
      ]},
    en: {title:'Class loading', door:'When is a class loaded? Delegation, three stages, static and constructor order, classic traps.',
      ui:{delegation:'Parent delegation', pressNext:'Press Next.', ldr:['Core JDK classes: java.lang and so on', 'Extra JDK modules: java.sql and so on', 'Your code, the classpath'],
        d_ask:(l, c) => `The code asks for \`${c}\`. The request reaches the ${l} ClassLoader.`, d_up:l => `It does not load yet: it asks its parent first: ${l}.`, d_down:(l, c, m) => `${m} did not find it. The request goes back to ${l}.`, d_found:(l, c) => `${l} found and loaded \`${c}\`.`,
        mLoad:'`String.class.getClassLoader()` returned `null`, because Bootstrap is not a Java object. `java.sql.Connection`: PlatformClassLoader. Our own class: AppClassLoader.',
        mOut:'The output is the real result of running this code with `java`.', classes:'State of the classes', linkNote:'The middle three stages together are called Linking. Resolution can be lazy.',
        st:{none:'not loaded', loaded:'loaded', linked:'linked', init:'initialized', failed:'failed'},
        c_phLoad:c => `Loading: \`${c}.class\` is read and class data appears in the method area.`, c_phVerify:() => 'Verification: the bytecode is checked for safety.', c_phPrepare:() => 'Preparation: static fields get default values, `z = 0`. The constant `X` is already 5, from `ConstantValue`.', c_phResolve:() => 'Resolution: symbolic references become real addresses.', c_phInit:() => 'Initialization: `<clinit>` runs and `z` is now 7.',
        c_needParent:c => `\`new ${c}()\`: the parent class must be ready first.`, c_sf:c => `A static field of \`${c}\` runs.`, c_sb:c => `The static block of \`${c}\` runs.`, c_if:c => `An instance field of \`${c}\` runs.`, c_ib:c => `The instance block of \`${c}\` runs.`, c_ct:c => `The constructor body of \`${c}\` runs.`, c_super:() => 'The first job of a constructor is to call `super()`: the `P` part is built first.', c_noStatic:() => 'Second `new C()`: the static part does not run again, only the instance part.', c_use:() => 'The value is used.',
        c_alloc:() => 'The object was created. Fields hold defaults: `name = null`.', c_pCtor:() => 'The `P` constructor runs, and the fields of `C` are not set yet.', c_virt:() => 'The method is virtual: `C.hello` is called while `name` is still `null`.', c_after:() => 'The object is fully built, so `name` is visible now.',
        c_constant:() => '`K.X` is a compile-time constant: the value was copied into `Main`, so `K` is not initialized.', c_notConst:() => '`Integer Y` is not a constant: `K` is initialized.', c_parentOnly:() => 'The field is in `Par`: only `Par` is initialized, not `Ch`.', c_arrayNo:() => 'Creating an array does not initialize `Ch`.', c_childNever:() => '`Ch init` was never printed.',
        c_prep2:() => 'Preparation: `a = 0`, `c = 0`.', c_readEarly:() => '`b()` runs and reads `c`: still 0, because line order matters.', c_boom1:() => 'First error: an exception in `<clinit>` throws `ExceptionInInitializerError`.', c_boom2:() => 'Second attempt: the class is broken for good, and now you get `NoClassDefFoundError`.'},
      ch:[
        ['ClassLoaders and delegation', ['Three main ClassLoaders load classes. Each one asks its parent first, and searches itself only if the parent finds nothing.', 'This is why your own `java.lang.String` would not replace the one from the JDK.', 'Pick a class with the buttons and follow the request.']],
        ['Three stages', ['A class is loaded, then linked, then initialized. Each happens once.', 'In Preparation, `static` fields get default values. The value you wrote arrives only in Initialization.', 'The JVM does not initialize a class until its first real use.']],
        ['Static and constructor order', ['A favorite interview question: the static part first, parent to child. Then for each `new`, the instance part, again parent to child.', 'Inside a class, fields and blocks run in written order. The constructor body is last.', 'Follow how the output appears line by line.']],
        ['A virtual method in a constructor', ['`name` is written as `"Aysel"`, yet the first output is `name=null`.', 'The parent constructor calls a virtual method and Java picks the child version. At that moment the fields of the child are not set.', 'The rule: do not call overridable methods in a constructor.']],
        ['When does initialization happen?', ['It takes real use: `new`, a static method, or a static field that is not a constant.', '`static final int X = 5` is a compile-time constant, copied at compile time. `static final Integer Y` is not a constant.', 'Using a parent field through the child name initializes only the parent. Creating an array initializes nothing.']],
        ['Two traps', ['Static fields run in line order. When `a` reads `c`, `c` is still 0, not 10.', 'An exception in `<clinit>` breaks the class for good: `ExceptionInInitializerError` the first time, then `NoClassDefFoundError` every time.', 'The second error hides the real cause, so look for the first one in the log.']],
      ]},
  },
};
