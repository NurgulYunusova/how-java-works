/* ---------- Threads: the reader picks which thread runs next ---------- */
const TH_INC = [{c:'r = count;', op:'read'}, {c:'r = r + 1;', op:'add'}, {c:'count = r;', op:'write'}];
const TH_SYNC = [{c:'synchronized (lock) {', op:'lock', l:'lock'}, {c:'  r = count;', op:'read'}, {c:'  r = r + 1;', op:'add'}, {c:'  count = r;', op:'write'}, {c:'}', op:'unlock', l:'lock'}];
const TH_CAS = [{c:'expected = count;', op:'read'}, {c:'next = expected + 1;', op:'add'}, {c:'CAS(count, expected, next);', op:'cas'}];
const TH_DL = order => [{c:`synchronized (${order[0]}) {`, op:'lock', l:order[0]}, {c:`  synchronized (${order[1]}) {`, op:'lock', l:order[1]}, {c:'    work();', op:'nop'}, {c:'  }', op:'unlock', l:order[1]}, {c:'}', op:'unlock', l:order[0]}];
const TH_VIS = {w:[{c:'while (running) {', op:'loop'}, {c:'}', op:'nop'}], m:[{c:'running = false;', op:'setflag'}]};
const TH_CH = {
  0: {prog:[TH_INC, TH_INC], sched:[0, 1, 0, 0, 1, 1], kind:'count'},
  1: {prog:[TH_SYNC, TH_SYNC], sched:[0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1], kind:'count'},
  2: {prog:[TH_INC, TH_INC], sched:[0, 1, 0, 0, 1, 1], kind:'count', vol:true},
  3: {prog:[TH_CAS, TH_CAS], sched:[0, 1, 0, 0, 1, 1, 1, 1, 1], kind:'count'},
  4: {prog:[TH_DL(['a', 'b']), TH_DL(['b', 'a'])], alt:[TH_DL(['a', 'b']), TH_DL(['a', 'b'])], sched:[0, 1, 0, 1], altSched:[0, 1, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1], kind:'dead'},
};
function thReplay(cfg, picks, alt) {
  const prog = alt && cfg.alt ? cfg.alt : cfg.prog;
  const s = {count:0, locks:{}, th:[{pc:0, r:null, st:'RUNNABLE', exp:null, fail:0}, {pc:0, r:null, st:'RUNNABLE', exp:null, fail:0}], ev:null, prog};
  const names = ['A', 'B'];
  const step = t => {
    const T = s.th[t], list = prog[t];
    if (T.pc >= list.length) return false;
    const o = list[T.pc];
    if (o.op === 'lock') {
      if (s.locks[o.l] !== undefined && s.locks[o.l] !== t) { T.st = 'BLOCKED'; s.ev = ['blocked', names[t], o.l]; return true; }
      s.locks[o.l] = t; T.st = 'RUNNABLE'; T.pc++; s.ev = ['locked', names[t], o.l];
    } else if (o.op === 'unlock') {
      delete s.locks[o.l]; T.pc++; s.ev = ['unlocked', names[t], o.l];
      s.th.forEach(x => { if (x.st === 'BLOCKED') x.st = 'RUNNABLE'; });
    } else if (o.op === 'read') { T.r = s.count; T.exp = s.count; T.pc++; s.ev = ['read', names[t], s.count]; }
    else if (o.op === 'add') { T.r = T.r + 1; T.pc++; s.ev = ['add', names[t], T.r]; }
    else if (o.op === 'write') { s.count = T.r; T.pc++; s.ev = ['write', names[t], T.r]; }
    else if (o.op === 'cas') {
      if (s.count === T.exp) { s.count = T.r; T.pc++; s.ev = ['casOk', names[t], T.exp, T.r]; }
      else { T.fail++; s.ev = ['casFail', names[t], T.exp, s.count]; T.pc = 0; T.r = null; }
    } else { T.pc++; s.ev = ['work', names[t]]; }
    if (T.pc >= list.length) T.st = 'TERMINATED';
    return true;
  };
  picks.forEach(step);
  s.deadlock = s.th.every(x => x.st === 'BLOCKED');
  s.done = s.th.every(x => x.st === 'TERMINATED');
  return s;
}
function thCard(s, i, cfg, ch) {
  const T = s.th[i], name = ['A', 'B'][i], list = s.prog[i];
  const stCls = {RUNNABLE:'mint', BLOCKED:'dead', TERMINATED:'lilac'}[T.st];
  const rv = T.r === null ? '<em>-</em>' : `<i class="val">${T.r}</i>`;
  return `<div class="thc"><div class="thc-h"><h3>Thread ${name}</h3>${tag(stCls, T.st)}</div>${codeBlock(list.map(o => o.c), T.pc < list.length ? T.pc : -1)}${cfg.kind === 'count' ? `<div class="thvar"><span>Stack: <code class="bare">${ch === 3 ? 'expected / next' : 'r'}</code></span>${ch === 3 ? `<span>${T.exp === null ? '<em>-</em>' : `<i class="val">${T.exp}</i>`} / ${rv}</span>` : rv}</div>` : ''}
    <button class="btn" type="button" data-act="run" data-v="${i}"${T.st === 'TERMINATED' || s.deadlock ? ' disabled' : ''}>${esc(ls$('runT', name))}</button></div>`;
}
function thHeap(s, cfg) {
  const locks = cfg.kind === 'dead' ? ['a', 'b'] : cfg.prog[0].some(o => o.op === 'lock') ? ['lock'] : [];
  const lk = locks.map(l => `<span class="lockb${s.locks[l] !== undefined ? ' held' : ''}"><code class="bare">${l}</code> ${s.locks[l] !== undefined ? esc(ls$('heldBy', ['A', 'B'][s.locks[l]])) : esc(lu('free'))}</span>`).join('');
  return `<div class="thheap"><h3>Heap</h3>${cfg.kind === 'count' ? `<div class="thcount"><code class="bare">${cfg.vol ? 'volatile ' : ''}${'int'} count</code><b class="val big">${s.count}</b></div>` : ''}${lk}</div>`;
}
function thVerdict(s, cfg, ch) {
  if (cfg.kind === 'dead') return s.deadlock ? `<p class="verdict bad">${rich(lu('deadlock'))}</p>` : s.done ? `<p class="verdict ok">${rich(lu('noDead'))}</p>` : '';
  if (!s.done) return '';
  return s.count === 2 ? `<p class="verdict ok">${rich(ls$('resOk', 2))}</p>` : `<p class="verdict bad">${rich(ls$('resBad', s.count))}</p>`;
}
const TH_STATES = [['NEW'], ['RUNNABLE'], ['BLOCKED'], ['WAITING'], ['TIMED_WAITING'], ['TERMINATED']];
LS.threads = {
  init(i) { if (TH_CH[i]) return {picks:[], alt:false}; if (i === 5) return {i:0, vol:false}; return {}; },
  controls(st, ch) {
    if (TH_CH[ch]) { const c = TH_CH[ch], s = thReplay(c, st.picks, st.alt), plan = st.alt ? c.altSched : c.sched, n = st.picks.length; return lsStepper(n, s.done || s.deadlock ? n : Math.max(plan.length, n + 1), c.alt ? `<button class="btn" type="button" data-act="alt">${esc(st.alt ? lu('badOrder') : lu('goodOrder'))}</button>` : ''); }
    if (ch === 5) return `<div class="stepbar"><button class="btn primary" type="button" data-act="vol">${esc(st.vol ? lu('makePlain') : lu('makeVol'))}</button><button class="btn" type="button" data-act="flag"${st.i ? ' disabled' : ''}><code class="bare">running = false</code></button><button class="btn ghost" type="button" data-act="reset">${esc(LS_UI[LANG].reset)}</button></div>`;
    return '';
  },
  stage(st, ch) {
    if (TH_CH[ch]) {
      const cfg = TH_CH[ch], s = thReplay(cfg, st.picks, st.alt);
      const ev = s.ev ? ls$(...s.ev) : lu('pressNext');
      const extra = ch === 0 ? pnl('', measured(rich(lu('m0')))) : ch === 1 ? pnl('', measured(rich(lu('m1')))) : ch === 2 ? pnl('', measured(rich(lu('m2')))) : ch === 3 ? pnl('', measured(rich(lu('m3')))) : pnl('', measured(rich(lu('m4'))));
      return pnl('', `<div class="thgrid">${thCard(s, 0, cfg, ch)}${thHeap(s, cfg)}${thCard(s, 1, cfg, ch)}</div><p class="explain-s">${rich(ev)}</p>${thVerdict(s, cfg, ch)}`) + extra;
    }
    if (ch === 5) {
      const stopped = st.i && st.vol;
      return pnl('', `<div class="thgrid vis"><div class="thc"><div class="thc-h"><h3>Worker</h3>${tag(stopped ? 'lilac' : 'mint', stopped ? 'TERMINATED' : 'RUNNABLE')}</div>${codeBlock(['while (running) {', '}'], stopped ? -1 : 0)}<div class="thvar"><span>${esc(lu('sees'))} <code class="bare">running</code></span><i class="val">${stopped || (st.vol && st.i) ? 'false' : 'true'}</i></div></div><div class="thheap"><h3>Heap</h3><div class="thcount"><code class="bare">${st.vol ? 'volatile ' : ''}boolean running</code><b class="val big">${st.i ? 'false' : 'true'}</b></div></div></div><p class="explain-s">${rich(!st.i ? lu('visStart') : st.vol ? lu('visVol') : lu('visPlain'))}</p>`)
        + pnl('', measured(rich(lu('m5'))) + simplified(rich(lu('visModel'))));
    }
    const d = lsX().ui.states;
    return pnl(lu('statesT'), `<table class="demo"><thead><tr><th>Thread.State</th><th>${esc(lu('when'))}</th></tr></thead><tbody>${TH_STATES.map((r, i) => `<tr><td><code>${r[0]}</code></td><td>${rich(d[i])}</td></tr>`).join('')}</tbody></table>`) + pnl('', measured(rich(lu('m6'))));
  },
  act(st, a, v, ch) {
    if (TH_CH[ch]) {
      const c = TH_CH[ch];
      if (a === 'next') { const s = thReplay(c, st.picks, st.alt), plan = st.alt ? c.altSched : c.sched, n = st.picks.length; let p = plan.slice(0, n).every((x, j) => x === st.picks[j]) && n < plan.length ? plan[n] : st.picks[n - 1] === 0 ? 1 : 0; if (s.th[p].st === 'TERMINATED') p = 1 - p; if (!s.done && !s.deadlock) st.picks.push(p); }
      if (a === 'prev') st.picks.pop();
      if (a === 'reset') st.picks = [];
      if (a === 'run') st.picks.push(+v);
      if (a === 'alt') { st.alt = !st.alt; st.picks = []; }
      return;
    }
    if (ch === 5) { if (a === 'vol') { st.vol = !st.vol; st.i = 0; } if (a === 'flag') st.i = 1; if (a === 'reset') st.i = 0; }
  },
  text: {
    az: {title:'Thread-lər', door:'İki thread-i özün idarə et. Race condition, synchronized, volatile, CAS və deadlock.',
      ui:{runT:n => `Thread ${n}: bir addım`, pressNext:'Növbəti düyməsini bas və ya thread-i özün seç.', heldBy:n => `Thread ${n}-də`, free:'boşdur',
        read:(n, v) => `Thread ${n} heap-dən \`count = ${v}\` oxudu.`, add:(n, v) => `Thread ${n} öz stack-ində ${v} hesabladı. Heap hələ dəyişmədi.`, write:(n, v) => `Thread ${n} heap-ə ${v} yazdı.`, locked:(n, l) => `Thread ${n} \`${l}\` lock-unu aldı.`, unlocked:(n, l) => `Thread ${n} \`${l}\` lock-unu buraxdı.`, blocked:(n, l) => `Thread ${n} \`${l}\` lock-unu gözləyir: BLOCKED.`, casOk:(n, e, x) => `Thread ${n}: \`count\` hələ ${e}-dir, CAS uğurlu oldu və ${x} yazdı.`, casFail:(n, e, c) => `Thread ${n}: ${e} gözləyirdi, amma \`count\` artıq ${c}-dir. CAS uğursuz oldu, thread yenidən başlayır.`, work:n => `Thread ${n} iki lock-la işini gördü.`,
        resOk:n => `Nəticə: \`count = ${n}\`. Heç bir artım itmədi.`, resBad:n => `Nəticə: \`count = ${n}\`. İki dəfə artırıldı, amma bir artım itdi.`, deadlock:'Deadlock: hər thread o birinin lock-unu gözləyir. Heç biri davam edə bilmir.', noDead:'Hər iki thread lock-ları eyni sırada aldı, deadlock olmadı.', goodOrder:'Lock sırasını eyniləşdir', badOrder:'Lock sırasını tərsinə qaytar',
        m0:'Hər thread `count++` işini 1 000 000 dəfə etdi. Gözlənilən 2 000 000, alınan 1 283 952.', m1:'Eyni test `synchronized` ilə: 2 000 000.', m2:'Eyni test `volatile int` ilə: 1 043 704. Yenə itki var.', m3:'Eyni test `AtomicInteger.incrementAndGet()` ilə: 2 000 000.', m4:'Real proqramda iki thread də `BLOCKED` oldu və `ThreadMXBean.findDeadlockedThreads()` onları tapdı.', m5:'`while (running)` dövrəsində adi `boolean`-da thread `false`-dan 3 saniyə sonra da işləyirdi, `volatile`-da dərhal dayandı. Nəticə JIT-dən asılıdır.', m6:'`NEW`, `WAITING`, `TIMED_WAITING`, `BLOCKED` və `TERMINATED` vəziyyətləri `getState()` ilə real thread-lərdə yoxlandı.',
        sees:'Görür:', makeVol:'volatile et', makePlain:'adi boolean et', visStart:'`running = false` düyməsini bas: worker dayanacaqmı?', visPlain:'Heap-də `false`-dur, amma worker hələ `true` görür və dövrə davam edir. JIT `running`-i yenidən oxumamağa haqlıdır, çünki başqa thread-in dəyişikliyi zəmanətli deyil.', visVol:'`volatile` yazma ilə oxuma arasında happens-before əlaqəsi var. Worker `false` görür və dayanır.', visModel:'CPU cache-ni göstərmirik: bu, Java Memory Model-in nə zəmanət verdiyini göstərir, hardware-in nə etdiyini yox.',
        statesT:'Thread.State', when:'Nə vaxt', states:['`new Thread()` yaradılıb, `start()` çağırılmayıb.', 'İşləyir və ya CPU gözləyir. Java ikisini ayırmır.', '`synchronized` üçün lock gözləyir.', '`wait()` və ya `join()`-da vaxtsız gözləyir.', '`sleep(ms)` və ya vaxtlı `wait`-də gözləyir.', '`run()` bitib.']},
      ch:[
        ['Race condition: count++', ['Hər thread-in öz stack-i var, heap isə ortaqdır. `count` heap-dədir, `r` isə stack-də.', '`count++` tək əməliyyat deyil: oxu, artır, yaz. İki thread eyni dəyəri oxusa, biri o birinin nəticəsinin üstünə yazır.', 'Növbəti düyməsi hazır sıranı göstərir. Thread düymələri ilə sıranı özün seç: hansı sırada itki olmur?']],
        ['synchronized', ['`synchronized` bir object-in monitor lock-unu alır. Eyni lock-u eyni anda yalnız bir thread saxlaya bilər, o biri `BLOCKED` olur.', 'İndi thread B-ni A-nın ortasına sal: B irəliləyə bilmir, ona görə üç addım bir yerdə işləyir.', 'Lock həm də görünməni təmin edir: lock-u alan thread əvvəlki sahibin yazdıqlarını görür. Qiyməti gözləmədir, lock-u mümkün qədər qısa saxla.']],
        ['volatile count++-ı düzəltmir', ['`volatile` hər oxumanın ən son yazılmış dəyəri görməsini təmin edir. Amma oxu, artır, yaz yenə üç ayrı addımdır.', 'Fərqə bax: eyni sıra, eyni itki. `volatile` atomicity vermir.', '`volatile` bir thread yazır, başqaları oxuyur olan hallar üçündür: növbəti bölmələrdəki `running` flag-i kimi.']],
        ['CAS və AtomicInteger', ['`AtomicInteger` lock işlətmir. CAS, yəni compare-and-swap, hardware-in tək addımda etdiyi işdir: dəyər gözlədiyim kimidirsə, yenisini yaz, deyilsə, heç nə etmə.', 'Uğursuz olan thread gözləmir, yenidən oxuyub cəhd edir. Thread-lər `BLOCKED` olmur.', 'Sıx rəqabətdə çox təkrar ola bilər. Çox yazılan sayğac üçün `LongAdder` də var.']],
        ['Deadlock', ['Thread A `a`-nı, B `b`-ni alır. Sonra A `b`-ni, B `a`-nı istəyir. İkisi də əbədi gözləyir, Java bunu özü həll etmir.', 'Ən sadə həll: bütün thread-lər lock-ları eyni sırada alsın. Düymə ilə sıranı dəyiş və yenidən işə sal.', 'Real proqramda `jstack` deadlock-u tapıb göstərir.']],
        ['Görünmə: volatile flag', ['Bir thread-in yazdığını o biri nə vaxt görür? Sinxronizasiya yoxdursa, Java zəmanət vermir.', 'Bu dövrədə worker `running`-i oxuyur. JIT dəyərin dəyişmədiyini fərz edib yenidən oxumaya bilər, thread əbədi fırlanır.', '`volatile`, `synchronized` və `Thread.start`/`join` happens-before yaradır, yəni görünməyə zəmanət verir.']],
        ['Thread vəziyyətləri', ['`Thread.getState()` altı dəyərdən birini qaytarır. Bu, thread dump oxuyanda ən çox lazım olan cədvəldir.', 'Tələ: `RUNNABLE` “indi CPU-dadır” demək deyil. I/O gözləyən thread də çox vaxt `RUNNABLE` görünür.']],
      ]},
    tr: {title:"Thread'ler", door:"İki thread'i kendin yönet. Race condition, synchronized, volatile, CAS ve deadlock.",
      ui:{runT:n => `Thread ${n}: bir adım`, pressNext:"Sonraki düğmesine bas veya thread'i kendin seç.", heldBy:n => `Thread ${n} tutuyor`, free:'boş',
        read:(n, v) => `Thread ${n} heap'ten \`count = ${v}\` okudu.`, add:(n, v) => `Thread ${n} kendi stack'inde ${v} hesapladı. Heap henüz değişmedi.`, write:(n, v) => `Thread ${n} heap'e ${v} yazdı.`, locked:(n, l) => `Thread ${n} \`${l}\` lock'unu aldı.`, unlocked:(n, l) => `Thread ${n} \`${l}\` lock'unu bıraktı.`, blocked:(n, l) => `Thread ${n} \`${l}\` lock'unu bekliyor: BLOCKED.`, casOk:(n, e, x) => `Thread ${n}: \`count\` hâlâ ${e}, CAS başarılı oldu ve ${x} yazdı.`, casFail:(n, e, c) => `Thread ${n}: ${e} bekliyordu, ama \`count\` artık ${c}. CAS başarısız oldu, thread yeniden başlıyor.`, work:n => `Thread ${n} iki lock ile işini yaptı.`,
        resOk:n => `Sonuç: \`count = ${n}\`. Hiçbir artış kaybolmadı.`, resBad:n => `Sonuç: \`count = ${n}\`. İki kez artırıldı, ama bir artış kayboldu.`, deadlock:"Deadlock: her thread diğerinin lock'unu bekliyor. Hiçbiri devam edemiyor.", noDead:"İki thread de lock'ları aynı sırada aldı, deadlock olmadı.", goodOrder:'Lock sırasını aynı yap', badOrder:'Lock sırasını ters çevir',
        m0:'Her thread `count++` işini 1 000 000 kez yaptı. Beklenen 2 000 000, çıkan 1 283 952.', m1:'Aynı test `synchronized` ile: 2 000 000.', m2:'Aynı test `volatile int` ile: 1 043 704. Yine kayıp var.', m3:'Aynı test `AtomicInteger.incrementAndGet()` ile: 2 000 000.', m4:"Gerçek programda iki thread de `BLOCKED` oldu ve `ThreadMXBean.findDeadlockedThreads()` onları buldu.", m5:"`while (running)` döngüsünde normal `boolean` ile thread `false` sonrası 3 saniye boyunca çalıştı, `volatile` ile hemen durdu. Sonuç JIT'e bağlıdır.", m6:"`NEW`, `WAITING`, `TIMED_WAITING`, `BLOCKED` ve `TERMINATED` durumları `getState()` ile gerçek thread'lerde kontrol edildi.",
        sees:'Görüyor:', makeVol:'volatile yap', makePlain:'normal boolean yap', visStart:'`running = false` düğmesine bas: worker duracak mı?', visPlain:"Heap'te `false`, ama worker hâlâ `true` görüyor ve döngü sürüyor. JIT `running` değerini yeniden okumayabilir, çünkü başka thread'in değişikliği garanti değildir.", visVol:'`volatile` yazma ile okuma arasında happens-before ilişkisi vardır. Worker `false` görür ve durur.', visModel:"CPU cache'i göstermiyoruz: bu, Java Memory Model'in neyi garanti ettiğini gösterir, hardware'in ne yaptığını değil.",
        statesT:'Thread.State', when:'Ne zaman', states:['`new Thread()` oluşturuldu, `start()` çağrılmadı.', 'Çalışıyor veya CPU bekliyor. Java ikisini ayırmaz.', "`synchronized` için lock bekliyor.", '`wait()` veya `join()` içinde süresiz bekliyor.', '`sleep(ms)` veya süreli `wait` içinde bekliyor.', '`run()` bitti.']},
      ch:[
        ['Race condition: count++', ["Her thread'in kendi stack'i vardır, heap ise ortaktır. `count` heap'te, `r` stack'tedir.", "`count++` tek işlem değildir: oku, artır, yaz. İki thread aynı değeri okursa biri diğerinin sonucunun üstüne yazar.", 'Sonraki düğmesi hazır sırayı gösterir. Thread düğmeleriyle sırayı kendin seç: hangi sırada kayıp olmaz?']],
        ['synchronized', ["`synchronized` bir object'in monitor lock'unu alır. Aynı lock'u aynı anda yalnızca bir thread tutabilir, diğeri `BLOCKED` olur.", "Şimdi thread B'yi A'nın ortasına sok: B ilerleyemez, bu yüzden üç adım birlikte çalışır.", "Lock görünürlüğü de sağlar: lock'u alan thread önceki sahibin yazdıklarını görür. Bedeli beklemedir, lock'u mümkün olduğunca kısa tut."]],
        ["volatile count++'ı düzeltmez", ['`volatile` her okumanın en son yazılan değeri görmesini sağlar. Ama oku, artır, yaz yine üç ayrı adımdır.', 'Farka bak: aynı sıra, aynı kayıp. `volatile` atomicity vermez.', "`volatile` bir thread'in yazıp diğerlerinin okuduğu durumlar içindir: sonraki bölümlerdeki `running` flag'i gibi."]],
        ['CAS ve AtomicInteger', ["`AtomicInteger` lock kullanmaz. CAS, yani compare-and-swap, hardware'in tek adımda yaptığı iştir: değer beklediğim gibiyse yenisini yaz, değilse hiçbir şey yapma.", 'Başarısız olan thread beklemez, yeniden okuyup dener. Thread\'ler `BLOCKED` olmaz.', 'Yoğun rekabette çok tekrar olabilir. Çok yazılan sayaç için `LongAdder` da vardır.']],
        ['Deadlock', ["Thread A `a`'yı, B `b`'yi alır. Sonra A `b`'yi, B `a`'yı ister. İkisi de sonsuza kadar bekler, Java bunu kendi çözmez.", "En basit çözüm: tüm thread'ler lock'ları aynı sırada alsın. Düğmeyle sırayı değiştir ve yeniden çalıştır.", "Gerçek programda `jstack` deadlock'u bulup gösterir."]],
        ['Görünürlük: volatile flag', ['Bir thread\'in yazdığını diğeri ne zaman görür? Senkronizasyon yoksa Java garanti vermez.', "Bu döngüde worker `running` değerini okur. JIT değerin değişmediğini varsayıp yeniden okumayabilir, thread sonsuza kadar döner.", '`volatile`, `synchronized` ve `Thread.start`/`join` happens-before oluşturur, yani görünürlüğü garanti eder.']],
        ['Thread durumları', ['`Thread.getState()` altı değerden birini döndürür. Thread dump okurken en çok gereken tablo budur.', 'Tuzak: `RUNNABLE` "şu an CPU\'da" demek değildir. I/O bekleyen thread de çoğu zaman `RUNNABLE` görünür.']],
      ]},
    en: {title:'Threads', door:'Drive two threads yourself. Race conditions, synchronized, volatile, CAS and deadlock.',
      ui:{runT:n => `Thread ${n}: one step`, pressNext:'Press Next, or pick the thread yourself.', heldBy:n => `held by Thread ${n}`, free:'free',
        read:(n, v) => `Thread ${n} read \`count = ${v}\` from the heap.`, add:(n, v) => `Thread ${n} computed ${v} on its own stack. The heap has not changed.`, write:(n, v) => `Thread ${n} wrote ${v} to the heap.`, locked:(n, l) => `Thread ${n} took lock \`${l}\`.`, unlocked:(n, l) => `Thread ${n} released lock \`${l}\`.`, blocked:(n, l) => `Thread ${n} is waiting for lock \`${l}\`: BLOCKED.`, casOk:(n, e, x) => `Thread ${n}: \`count\` is still ${e}, so CAS succeeded and wrote ${x}.`, casFail:(n, e, c) => `Thread ${n} expected ${e}, but \`count\` is now ${c}. CAS failed and the thread starts over.`, work:n => `Thread ${n} did its work with both locks.`,
        resOk:n => `Result: \`count = ${n}\`. No increment was lost.`, resBad:n => `Result: \`count = ${n}\`. It was incremented twice, but one increment was lost.`, deadlock:'Deadlock: each thread waits for the lock of the other. Neither can continue.', noDead:'Both threads took the locks in the same order, so no deadlock.', goodOrder:'Use the same lock order', badOrder:'Reverse the lock order',
        m0:'Each thread ran `count++` 1,000,000 times. Expected 2,000,000, got 1,283,952.', m1:'The same test with `synchronized`: 2,000,000.', m2:'The same test with `volatile int`: 1,043,704. Still lost updates.', m3:'The same test with `AtomicInteger.incrementAndGet()`: 2,000,000.', m4:'In a real program both threads became `BLOCKED`, and `ThreadMXBean.findDeadlockedThreads()` found them.', m5:'In a `while (running)` loop with a plain `boolean`, the thread was still running 3 seconds after `false`. With `volatile` it stopped at once. The result depends on the JIT.', m6:'`NEW`, `WAITING`, `TIMED_WAITING`, `BLOCKED` and `TERMINATED` were checked on real threads with `getState()`.',
        sees:'Sees:', makeVol:'Make it volatile', makePlain:'Make it a plain boolean', visStart:'Press `running = false`: will the worker stop?', visPlain:'The heap says `false`, but the worker still sees `true` and keeps looping. The JIT may skip re-reading `running`, because a change from another thread is not guaranteed to be visible.', visVol:'A `volatile` write and read create a happens-before relation. The worker sees `false` and stops.', visModel:'CPU caches are not drawn: this shows what the Java Memory Model guarantees, not what the hardware does.',
        statesT:'Thread.State', when:'When', states:['`new Thread()` was created, `start()` not called yet.', 'Running or waiting for a CPU. Java does not separate the two.', 'Waiting for a lock for `synchronized`.', 'Waiting with no timeout in `wait()` or `join()`.', 'Waiting with a timeout in `sleep(ms)` or a timed `wait`.', '`run()` has finished.']},
      ch:[
        ['Race condition: count++', ['Each thread has its own stack, while the heap is shared. `count` is on the heap and `r` is on the stack.', '`count++` is not one operation: read, add, write. If two threads read the same value, one overwrites the result of the other.', 'Next plays a prepared order. Use the thread buttons to choose your own: which orders lose nothing?']],
        ['synchronized', ['`synchronized` takes the monitor lock of an object. Only one thread can hold it at a time, and the other becomes `BLOCKED`.', 'Now try to run thread B in the middle of A: B cannot advance, so the three steps run together.', 'A lock also gives visibility: a thread taking the lock sees what the previous owner wrote. The price is waiting, so hold locks as briefly as you can.']],
        ['volatile does not fix count++', ['`volatile` makes every read see the latest write. But read, add and write are still three separate steps.', 'See for yourself: the same order loses the same update. `volatile` gives no atomicity.', '`volatile` fits when one thread writes and others read, like the `running` flag in a later section.']],
        ['CAS and AtomicInteger', ['`AtomicInteger` uses no lock. CAS, compare-and-swap, is a single hardware step: if the value is what I expect, write the new one, otherwise do nothing.', 'A thread that fails does not wait. It reads again and retries, so threads do not become `BLOCKED`.', 'Under heavy contention it can retry a lot. For counters with many writes there is also `LongAdder`.']],
        ['Deadlock', ['Thread A takes `a` and B takes `b`. Then A wants `b` and B wants `a`. Both wait forever, and Java does not resolve it.', 'The simplest fix: all threads take locks in the same order. Change the order with the button and run it again.', 'In a real program `jstack` finds and reports the deadlock.']],
        ['Visibility: a volatile flag', ['When does one thread see what another wrote? Without synchronization, Java makes no promise.', 'In this loop the worker reads `running`. The JIT may assume the value does not change and skip re-reading it, so the thread spins forever.', '`volatile`, `synchronized` and `Thread.start`/`join` create happens-before, which guarantees visibility.']],
        ['Thread states', ['`Thread.getState()` returns one of six values. This table is what you need most when reading a thread dump.', 'Trap: `RUNNABLE` does not mean "on a CPU right now". A thread waiting on I/O often shows as `RUNNABLE` too.']],
      ]},
  },
};
