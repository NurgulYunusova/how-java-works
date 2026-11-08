/* ---------- Virtual threads ---------- */
const VT_COL = ['#FFD426', '#FF9BCF', '#62E8AE', '#7FCDFF', '#C3B1FF', '#FFB36B', '#B8F06A', '#FF8F8F'];
const VT_PROG = ['cpu', 'io', 'io', 'io', 'cpu'], VT_IO = 3, VT_CARRIERS = 2;
/* A tick-based model of two carrier threads. Blocking I/O either parks the virtual thread (its stack moves to the heap)
   or keeps the carrier busy: always for a platform pool, and for a virtual thread pinned inside synchronized. */
function vtSim(n, blocking) {
  const vs = Array.from({length:n}, (_, i) => ({id:i + 1, pc:0, io:0, st:'queue'}));
  const queue = vs.slice(), parked = [], cars = Array(VT_CARRIERS).fill(null), ticks = [];
  for (let t = 0; t < 60 && vs.some(v => v.st !== 'done'); t++) {
    const cells = [], ev = [];
    cars.forEach((_, c) => {
      for (;;) {
        if (!cars[c]) { if (!queue.length) { cells[c] = {k:'idle'}; break; } cars[c] = queue.shift(); cars[c].st = 'run'; }
        const v = cars[c], op = VT_PROG[v.pc];
        if (op === 'cpu') {
          cells[c] = {k:'cpu', v:v.id}; v.pc++;
          if (v.pc === VT_PROG.length) { v.st = 'done'; v.end = t + 1; cars[c] = null; ev.push(['evDone', v.id]); }
          break;
        }
        if (!blocking) { v.st = 'park'; v.io = VT_IO; parked.push(v); cars[c] = null; ev.push(['evPark', v.id, c + 1]); continue; }
        if (!v.io) { v.io = VT_IO; ev.push(['evBlock', v.id, c + 1]); }
        cells[c] = {k:'io', v:v.id}; v.st = 'block';
        if (--v.io === 0) { v.pc += VT_IO; v.st = 'run'; }
        break;
      }
    });
    for (let k = parked.length - 1; k >= 0; k--) {
      const v = parked[k];
      if (--v.io === 0) { parked.splice(k, 1); v.pc += VT_IO; v.st = 'queue'; queue.push(v); ev.push(['evWake', v.id]); }
    }
    ticks.push({cells, ev, cars:cars.map(v => v && {id:v.id, st:v.st}), parked:parked.map(v => v.id), queue:queue.map(v => v.id), done:vs.filter(v => v.st === 'done').map(v => v.id)});
  }
  return ticks;
}
const vtChip = (id, cls) => `<span class="vtv${cls ? ' ' + cls : ''}" style="--c:${VT_COL[(id - 1) % VT_COL.length]}">V${id}</span>`;
function vtStage(st, blocking, pinned) {
  const T = vtSim(st.n, blocking), cur = st.i ? T[st.i - 1] : {cells:[], ev:[], cars:[null, null], parked:[], queue:Array.from({length:st.n}, (_, i) => i + 1), done:[]};
  const cars = cur.cars.map((v, c) => {
    const cell = cur.cells[c];
    const what = cell && cell.k === 'cpu' ? vtChip(cell.v) : cell && cell.k === 'io' ? vtChip(cell.v, 'io') : `<span class="muted small">${esc(lu('idle'))}</span>`;
    return `<div class="vtc"><h3>${esc(st.plat ? 'pool-1-thread-' + (c + 1) : 'ForkJoinPool-1-worker-' + (c + 1))}</h3>${what}${cell && cell.k === 'io' ? `<small class="vtnote">${esc(pinned ? lu('pinnedNow') : lu('blockedNow'))}</small>` : ''}</div>`;
  }).join('');
  const list = (title, ids, cls, empty) => `<div class="vtbox"><h4>${esc(title)}</h4><div class="vtpool">${ids.length ? ids.map(id => vtChip(id, cls)).join('') : `<span class="muted small">${esc(empty)}</span>`}</div></div>`;
  const cols = T.length;
  const tl = Array.from({length:VT_CARRIERS}, (_, c) => `<span class="vtl-h">${st.plat ? 'thread-' : 'worker-'}${c + 1}</span>` + T.map((tk, t) => {
    if (t >= st.i) return '<i class="fut"></i>';
    const x = tk.cells[c];
    if (x.k === 'idle') return '<i class="idle"></i>';
    return `<i class="${x.k}" style="--c:${VT_COL[(x.v - 1) % VT_COL.length]}">${x.v}</i>`;
  }).join('')).join('');
  const ev = cur.ev.length ? cur.ev.slice(0, 2).map(e => ls$(...e)).join(' ') : st.i ? lu('evRun') : lu('evStart');
  const other = vtSim(st.n, !blocking).length, mine = T.length, finished = st.i >= mine;
  const cmp = `<div class="gtext"><span><code>${esc(lu('ticks'))}</code> <b>${finished ? mine : '…'}</b></span><span><code>${esc(blocking ? lu('ifPark') : lu('ifBlock'))}</code> <b>${other}</b></span></div>`;
  return pnl(lu('carriersT'), `<div class="vtcar">${cars}</div><div class="vtrow">${list(st.plat ? lu('queuePlat') : lu('queue'), cur.queue, '', lu('none'))}${st.plat ? '' : list(lu('parked'), cur.parked, 'park', lu('none'))}${list(lu('done'), cur.done, 'done', lu('none'))}</div><p class="explain-s">${rich(ev)}</p>`)
    + pnl(lu('tlT'), `<div class="vtl" style="grid-template-columns:72px repeat(${cols}, minmax(0, 1fr))">${tl}</div><div class="legend">${tag('sun', 'CPU')}${tag('sky', blocking ? lu('lgBlock') : 'sleep')}</div>${cmp}${finished ? `<p class="verdict ${blocking ? 'bad' : 'ok'}">${esc(ls$(blocking ? 'vBad' : 'vOk', mine, other))}</p>` : ''}`);
}
const VT_CODE = {
  virtual:['try (var ex = Executors.newVirtualThreadPerTaskExecutor()) {', '    for (int i = 1; i <= n; i++)', '        ex.submit(() -> {', '            work();             // CPU', '            Thread.sleep(300);  // I/O', '            work();', '        });', '}'],
  plat:['try (var ex = Executors.newFixedThreadPool(2)) {', '    for (int i = 1; i <= n; i++)', '        ex.submit(() -> {', '            work();             // CPU', '            Thread.sleep(300);  // I/O', '            work();', '        });', '}'],
  pin:['ex.submit(() -> {', '    work();', '    synchronized (lock) {', '        Thread.sleep(300);  // pinned', '    }', '    work();', '});'],
  lock:['ex.submit(() -> {', '    work();', '    lock.lock();            // ReentrantLock', '    try { Thread.sleep(300); }', '    finally { lock.unlock(); }', '    work();', '});'],
};
const VT_SCALE = {10000:[50219, 0, 1047], 100000:[500000, 1, 1420], 1000000:[5000000, 1, 5395]};
LS.vthreads = {
  init(i) { if (i === 0) return {n:10000}; if (i === 1) return {i:0, n:4, plat:false}; if (i === 2) return {i:0, n:4, pin:true}; return {}; },
  controls(st, ch) {
    const b = (act, v, label, sel) => `<button class="btn${sel ? ' sel' : ''}" type="button" data-act="${act}" data-v="${v}" aria-pressed="${!!sel}">${label}</button>`;
    if (ch === 0) return `<div class="stepbar"><span class="seg">${Object.keys(VT_SCALE).map(n => b('n', n, `<code class="bare">${(+n).toLocaleString('en-US').replace(/,/g, ' ')}</code> task`, st.n === +n)).join('')}</span></div>`;
    if (ch === 1 || ch === 2) {
      const total = vtSim(st.n, ch === 1 ? st.plat : st.pin).length;
      const seg = ch === 1 ? `<span class="seg">${b('mode', '0', 'Virtual thread', !st.plat)}${b('mode', '1', esc(lu('platPool')), st.plat)}${[4, 6, 8].map(n => b('cnt', n, `<code class="bare">n = ${n}</code>`, st.n === n)).join('')}</span>`
        : `<span class="seg">${b('pin', '1', '<code class="bare">synchronized</code>', st.pin)}${b('pin', '0', '<code class="bare">ReentrantLock</code>', !st.pin)}</span>`;
      return lsStepper(st.i, total, seg);
    }
    return '';
  },
  stage(st, ch) {
    if (ch === 0) {
      const [pool, crash, vt] = VT_SCALE[st.n], nn = st.n.toLocaleString('en-US').replace(/,/g, ' ');
      const rows = [[lu('pool200'), pool, 'var(--lilac)', (pool / 1000).toFixed(1) + ' s' + (st.n > 10000 ? ' *' : '')], [lu('perTask'), pool, 'var(--error)', 'OOM'], ['virtual', vt, 'var(--sun)', (vt / 1000).toFixed(2) + ' s']];
      return pnl(ls$('scaleT', nn), lyBars(rows) + `<p class="muted small">${rich(st.n > 10000 ? ls$('est', nn) : lu('allMeasured'))}</p><p class="explain-s">${rich(lu('perTaskText'))}</p>`)
        + pnl(lu('errT'), `<pre class="logv">[51.492s][warning][os,thread] Failed to start thread "Unknown thread"
  - pthread_create failed (EAGAIN) for attributes:
    stacksize: 2048k, guardsize: 16k, detached.
Exception in thread "main" java.lang.OutOfMemoryError:
  unable to create native thread: possibly out of memory
  or process/resource limits reached</pre>${measured(rich(lu('m0')))}`);
    }
    if (ch === 1) {
      return pnl(lu('codeT'), codeBlock(st.plat ? VT_CODE.plat : VT_CODE.virtual, -1)) + vtStage(st, st.plat, false)
        + pnl('', `<pre class="logv">VirtualThread[#20]/runnable@ForkJoinPool-1-worker-1
  -&gt; VirtualThread[#20]/runnable@ForkJoinPool-1-worker-2
VirtualThread[#22]/runnable@ForkJoinPool-1-worker-2
  -&gt; VirtualThread[#22]/runnable@ForkJoinPool-1-worker-1</pre>${measured(rich(lu('m1')))}${simplified(rich(lu('model')))}`);
    }
    if (ch === 2) {
      return pnl(lu('codeT'), codeBlock(st.pin ? VT_CODE.pin : VT_CODE.lock, st.pin ? 2 : 2)) + vtStage(st, st.pin, st.pin)
        + pnl('', `<pre class="logv">-Djdk.tracePinnedThreads=short
VirtualThread[#31]/runnable@ForkJoinPool-1-worker-2 reason:MONITOR
    VT.lambda$main$3(VT.java:28) &lt;== monitors:1</pre>${lyBars([['synchronized', 416, 'var(--error)', '416 ms'], ['ReentrantLock', 105, 'var(--mint)', '105 ms']])}${measured(rich(lu('m2')))}`);
    }
    return pnl(lu('cpuT'), lyBars([[lu('pool2'), 826, 'var(--lilac)', '826 ms'], ['virtual', 822, 'var(--sun)', '822 ms']]) + measured(rich(lu('m3'))))
      + pnl(lu('rulesT'), `<ul class="rules">${lu('rules').map(r => `<li class="${r[0] ? 'ok' : 'bad'}"><span>${r[0] ? '✓' : '✗'}</span> ${rich(r[1])}</li>`).join('')}</ul>`);
  },
  act(st, a, v, ch) {
    if (ch === 0 && a === 'n') st.n = +v;
    if (ch === 1 || ch === 2) {
      const total = vtSim(st.n, ch === 1 ? st.plat : st.pin).length;
      if (a === 'next') st.i = Math.min(total, st.i + 1);
      if (a === 'prev') st.i = Math.max(0, st.i - 1);
      if (a === 'reset') st.i = 0;
      if (a === 'mode') { st.plat = v === '1'; st.i = 0; }
      if (a === 'cnt') { st.n = +v; st.i = 0; }
      if (a === 'pin') { st.pin = v === '1'; st.i = 0; }
    }
  },
  text: {
    az: {title:'Virtual Thread-lər', door:'Bir milyon thread necə mümkün olur: carrier, mount və unmount, pinning və virtual thread-in kömək etmədiyi hallar.',
      ui:{scaleT:n => `${n} task, hər biri 1 saniyə sleep edir`, pool200:'200 thread-lik pool', perTask:'hər task-a platform thread', est:n => `* ${n} task üçün pool vaxtı hesablamadır: task sayı / 200 × 1 s. Qalan rəqəmlər ölçülüb.`, allMeasured:'Bütün rəqəmlər ölçülüb.',
        perTaskText:'Platform thread əməliyyat sisteminin thread-idir və öz stack-i var. Bu Mac-də hər biri üçün 2 MB stack ayrılır. Hər task-a ayrıca platform thread açanda JVM təxminən 4000-ci thread-də dayandı.',
        errT:'Hər task-a platform thread', m0:'Bu Mac-də (10 nüvə, JDK 21) ölçülüb. 10 000 task: pool 50.2 s, virtual 1.05 s. 100 000 virtual thread 1.42 s, 1 000 000 virtual thread 5.4 s-də bitdi. Platform thread-lər 4057-ci thread-də `OutOfMemoryError` verdi. `ThreadStackSize` = 2048 KB.',
        codeT:'Kod', idle:'boşdur', blockedNow:'gözləyir, başqa iş görə bilmir', pinnedNow:'pinned: synchronized daxilində unmount ola bilmir', carriersT:'Carrier thread-lər', queue:'Növbə (runnable)', queuePlat:'Pool növbəsi', parked:'Park olunub: stack heap-dədir', done:'Bitib', none:'yoxdur', tlT:'Zaman xətti',
        lgBlock:'sleep, thread bloklanıb', ticks:'tick', ifPark:'unmount olsaydı', ifBlock:'bloklansaydı', platPool:'2 thread-lik pool',
        evStart:'Hamısı növbədədir. Növbəti addımı bas.', evRun:'Carrier-lər CPU işi görür.',
        evPark:(v, c) => `V${v} \`sleep\`-ə çatdı və worker-${c}-dən unmount oldu. Onun stack-i heap-ə köçürüldü, carrier dərhal növbədəki virtual thread-i götürdü.`,
        evBlock:(v, c) => `V${v} \`sleep\`-ə çatdı. Thread-${c} gözləyir və bu müddətdə başqa task götürə bilmir.`,
        evWake:v => `V${v}-in sleep-i bitdi və o, növbəyə qayıtdı. Hansı carrier boşalsa, onun üzərində davam edəcək.`, evDone:v => `V${v} işini bitirdi.`,
        vOk:(a, b) => `${a} tick-də bitdi. Bloklansaydı ${b} tick çəkərdi.`, vBad:(a, b) => `${a} tick-də bitdi. Unmount olsaydı ${b} tick-ə bitərdi.`,
        m1:'Real çıxış, JDK 21, `-Djdk.virtualThreadScheduler.parallelism=2`: `sleep`-dən əvvəl və sonra `Thread.currentThread()`. Eyni virtual thread başqa worker-də oyandı.',
        model:'Hər task-ın 1 tick CPU, 3 tick sleep, sonra yenə 1 tick CPU olduğu sadə model. Default olaraq carrier sayı nüvə sayına bərabərdir, burada 2 götürülüb.',
        m2:'JDK 21, 2 carrier, 8 task, hər biri öz kilidi ilə 100 ms sleep. `synchronized` 416 ms çəkdi, çünki carrier-lər gözləyirdi. `ReentrantLock` 105 ms çəkdi, çünki virtual thread-lər unmount olurdu.',
        cpuT:'CPU işi: 8 task, 2 thread', pool2:'2 thread-lik pool', m3:'JDK 21, 2 carrier. Hər task 300 milyon addımlıq hesablama aparır. Virtual thread-lər nüvə əlavə etmir, ona görə vaxt eyni qalır.', rulesT:'Nə vaxt işlətmək lazımdır',
        rules:[[1, 'Çoxlu gözləmə olan iş: HTTP sorğuları, database, fayllar. Hər sorğuya bir virtual thread aç.'], [1, 'Eyni anda neçə sorğu getdiyini məhdudlaşdırmaq lazımdırsa, `Semaphore` işlət.'], [0, 'Virtual thread-ləri pool-a yığma. Onlar ucuzdur, hər task üçün yenisini aç.'], [0, 'Ağır hesablamanı sürətləndirmir: nüvə sayı dəyişmir.'], [0, 'Java 21-də `synchronized` daxilində uzun gözləmə carrier-i tutur. `ReentrantLock` işlət və ya Java 24-ə keç.'], [0, '`ThreadLocal`-da böyük object saxlamaq: milyon thread olanda milyon kopya yaranır.']]},
      ch:[
        ['Platform thread bahalıdır', ['Adi `Thread` əməliyyat sisteminin thread-idir. Onun öz stack-i var, yaradılması və thread-lər arasında keçid bahalıdır.', 'Ona görə serverlər thread pool işlədir. Amma pool-dakı thread cavab gözləyəndə heç nə etmir. 200 thread varsa, eyni anda yalnız 200 sorğu gözləyə bilər.', 'Java 21-də virtual thread-lər gəldi. Onlar JVM-in öz thread-ləridir və milyonlarla yaradıla bilər.']],
        ['Mount və unmount', ['Virtual thread özü CPU-da işləmir. Onu az sayda platform thread icra edir. Bu thread-lərə carrier deyilir və onlar `ForkJoinPool`-dadır.', 'Virtual thread `sleep`, socket və ya lock gözləyəndə carrier-dən unmount olur: onun stack-i heap-ə köçürülür və carrier növbəti virtual thread-i götürür.', 'Gözləmə bitəndə virtual thread növbəyə qayıdır və boş olan istənilən carrier-də davam edir. Rejimi dəyiş və vaxtları müqayisə et.']],
        ['Pinning', ['Java 21-də virtual thread `synchronized` daxilində unmount ola bilmir, çünki monitor carrier thread-ə bağlıdır. Buna pinning deyilir: gözləmə müddətində carrier də gözləyir.', 'Native method daxilində də eyni şey olur. `-Djdk.tracePinnedThreads=short` belə yerləri göstərir.', 'Java 21-də həll yolu `ReentrantLock`-dur. Java 24-də (JEP 491) `synchronized` artıq pinning yaratmır.']],
        ['Nə vaxt kömək etmir', ['Virtual thread-lər gözləyən işi ucuzlaşdırır, hesablamanı isə sürətləndirmir. CPU işi üçün nüvə sayı qədər thread kifayətdir.', 'Onlar sadəcə ucuz thread-lərdir. Eyni anda neçə iş gedəcəyini məhdudlaşdırmaq üçün pool deyil, `Semaphore` işlədilir.']],
      ]},
    tr: {title:"Virtual Thread'ler", door:"Bir milyon thread nasıl mümkün olur: carrier, mount ve unmount, pinning ve virtual thread'in yardım etmediği durumlar.",
      ui:{scaleT:n => `${n} task, her biri 1 saniye sleep eder`, pool200:"200 thread'lik pool", perTask:"her task'a platform thread", est:n => `* ${n} task için pool süresi bir hesaplamadır: task sayısı / 200 × 1 s. Diğer rakamlar ölçüldü.`, allMeasured:'Tüm rakamlar ölçüldü.',
        perTaskText:"Platform thread işletim sisteminin thread'idir ve kendi stack'i vardır. Bu Mac'te her biri için 2 MB stack ayrılır. Her task'a ayrı platform thread açınca JVM yaklaşık 4000. thread'de durdu.",
        errT:"Her task'a platform thread", m0:"Bu Mac'te (10 çekirdek, JDK 21) ölçüldü. 10 000 task: pool 50.2 s, virtual 1.05 s. 100 000 virtual thread 1.42 s'de, 1 000 000 virtual thread 5.4 s'de bitti. Platform thread'ler 4057. thread'de `OutOfMemoryError` verdi. `ThreadStackSize` = 2048 KB.",
        codeT:'Kod', idle:'boş', blockedNow:'bekliyor, başka iş yapamaz', pinnedNow:'pinned: synchronized içinde unmount olamaz', carriersT:"Carrier thread'ler", queue:'Kuyruk (runnable)', queuePlat:'Pool kuyruğu', parked:"Park edildi: stack heap'te", done:'Bitti', none:'yok', tlT:'Zaman çizelgesi',
        lgBlock:'sleep, thread bloklu', ticks:'tick', ifPark:'unmount olsaydı', ifBlock:'bloklansaydı', platPool:"2 thread'lik pool",
        evStart:'Hepsi kuyrukta. Sonraki adıma bas.', evRun:"Carrier'lar CPU işi yapıyor.",
        evPark:(v, c) => `V${v} \`sleep\`'e geldi ve worker-${c}'den unmount oldu. Stack'i heap'e taşındı, carrier hemen kuyruktaki virtual thread'i aldı.`,
        evBlock:(v, c) => `V${v} \`sleep\`'e geldi. Thread-${c} bekliyor ve bu sürede başka task alamaz.`,
        evWake:v => `V${v}'in sleep'i bitti ve kuyruğa döndü. Hangi carrier boşalırsa onun üzerinde devam edecek.`, evDone:v => `V${v} işini bitirdi.`,
        vOk:(a, b) => `${a} tick'te bitti. Bloklansaydı ${b} tick sürerdi.`, vBad:(a, b) => `${a} tick'te bitti. Unmount olsaydı ${b} tick'te biterdi.`,
        m1:"Gerçek çıktı, JDK 21, `-Djdk.virtualThreadScheduler.parallelism=2`: `sleep`'ten önce ve sonra `Thread.currentThread()`. Aynı virtual thread başka bir worker'da uyandı.",
        model:"Her task'ın 1 tick CPU, 3 tick sleep ve tekrar 1 tick CPU olduğu basit bir model. Varsayılan carrier sayısı çekirdek sayısına eşittir, burada 2 alındı.",
        m2:"JDK 21, 2 carrier, 8 task, her biri kendi kilidiyle 100 ms sleep. `synchronized` 416 ms sürdü, çünkü carrier'lar bekliyordu. `ReentrantLock` 105 ms sürdü, çünkü virtual thread'ler unmount oluyordu.",
        cpuT:'CPU işi: 8 task, 2 thread', pool2:"2 thread'lik pool", m3:"JDK 21, 2 carrier. Her task 300 milyon adımlık bir hesap yapar. Virtual thread'ler çekirdek eklemez, bu yüzden süre aynı kalır.", rulesT:'Ne zaman kullanılmalı',
        rules:[[1, "Çok bekleme içeren iş: HTTP istekleri, veritabanı, dosyalar. Her isteğe bir virtual thread aç."], [1, "Aynı anda kaç istek gittiğini sınırlamak gerekiyorsa `Semaphore` kullan."], [0, "Virtual thread'leri pool'a koyma. Ucuzdurlar, her task için yenisini aç."], [0, 'Ağır hesaplamayı hızlandırmaz: çekirdek sayısı değişmez.'], [0, "Java 21'de `synchronized` içinde uzun bekleme carrier'ı tutar. `ReentrantLock` kullan veya Java 24'e geç."], [0, "`ThreadLocal`'da büyük object tutmak: milyon thread olunca milyon kopya oluşur."]]},
      ch:[
        ['Platform thread pahalıdır', ["Sıradan bir `Thread` işletim sisteminin thread'idir. Kendi stack'i vardır, oluşturmak ve thread'ler arasında geçiş yapmak pahalıdır.", "Bu yüzden sunucular thread pool kullanır. Ama pool'daki thread cevap beklerken hiçbir şey yapmaz. 200 thread varsa aynı anda sadece 200 istek bekleyebilir.", "Java 21'de virtual thread'ler geldi. Onlar JVM'in kendi thread'leridir ve milyonlarca oluşturulabilir."]],
        ['Mount ve unmount', ["Virtual thread kendisi CPU'da çalışmaz. Onu az sayıda platform thread çalıştırır. Bu thread'lere carrier denir ve `ForkJoinPool`'dadırlar.", "Virtual thread `sleep`, socket veya lock beklerken carrier'dan unmount olur: stack'i heap'e taşınır ve carrier sıradaki virtual thread'i alır.", "Bekleme bitince virtual thread kuyruğa döner ve boş olan herhangi bir carrier'da devam eder. Modu değiştir ve süreleri karşılaştır."]],
        ['Pinning', ["Java 21'de virtual thread `synchronized` içinde unmount olamaz, çünkü monitor carrier thread'e bağlıdır. Buna pinning denir: bekleme süresince carrier de bekler.", "Native method içinde de aynısı olur. `-Djdk.tracePinnedThreads=short` bu yerleri gösterir.", "Java 21'de çözüm `ReentrantLock`'tur. Java 24'te (JEP 491) `synchronized` artık pinning oluşturmaz."]],
        ['Ne zaman yardım etmez', ["Virtual thread'ler bekleyen işi ucuzlatır, hesaplamayı hızlandırmaz. CPU işi için çekirdek sayısı kadar thread yeterlidir.", "Onlar sadece ucuz thread'lerdir. Aynı anda kaç iş yürüyeceğini sınırlamak için pool değil, `Semaphore` kullanılır."]],
      ]},
    en: {title:'Virtual threads', door:'How a million threads become possible: carriers, mount and unmount, pinning and where virtual threads do not help.',
      ui:{scaleT:n => `${n} tasks, each sleeps for 1 second`, pool200:'pool of 200 threads', perTask:'a platform thread per task', est:n => `* For ${n} tasks the pool time is a calculation: tasks / 200 × 1 s. The other numbers were measured.`, allMeasured:'All numbers were measured.',
        perTaskText:'A platform thread is an operating system thread with its own stack. On this Mac each one reserves a 2 MB stack. With one platform thread per task, the JVM stopped at about the 4000th thread.',
        errT:'A platform thread per task', m0:'Measured on this Mac (10 cores, JDK 21). 10 000 tasks: pool 50.2 s, virtual 1.05 s. 100 000 virtual threads took 1.42 s and 1 000 000 took 5.4 s. Platform threads hit `OutOfMemoryError` at thread 4057. `ThreadStackSize` = 2048 KB.',
        codeT:'Code', idle:'idle', blockedNow:'waiting, cannot do other work', pinnedNow:'pinned: cannot unmount inside synchronized', carriersT:'Carrier threads', queue:'Queue (runnable)', queuePlat:'Pool queue', parked:'Parked: stack on the heap', done:'Done', none:'none', tlT:'Timeline',
        lgBlock:'sleep, thread blocked', ticks:'ticks', ifPark:'if it unmounted', ifBlock:'if it blocked', platPool:'pool of 2 threads',
        evStart:'Everything is queued. Press next.', evRun:'The carriers are doing CPU work.',
        evPark:(v, c) => `V${v} reached \`sleep\` and unmounted from worker-${c}. Its stack moved to the heap and the carrier took the next virtual thread from the queue right away.`,
        evBlock:(v, c) => `V${v} reached \`sleep\`. Thread-${c} waits and cannot take another task in the meantime.`,
        evWake:v => `V${v} finished sleeping and went back to the queue. It continues on whichever carrier is free first.`, evDone:v => `V${v} finished its work.`,
        vOk:(a, b) => `Done in ${a} ticks. With blocking it would take ${b}.`, vBad:(a, b) => `Done in ${a} ticks. With unmounting it would take ${b}.`,
        m1:'Real output, JDK 21, `-Djdk.virtualThreadScheduler.parallelism=2`: `Thread.currentThread()` before and after `sleep`. The same virtual thread woke up on another worker.',
        model:'A simple model where each task does 1 tick of CPU, 3 ticks of sleep and 1 more tick of CPU. By default there is one carrier per core; this model uses 2.',
        m2:'JDK 21, 2 carriers, 8 tasks, each sleeping 100 ms under its own lock. `synchronized` took 416 ms because the carriers waited. `ReentrantLock` took 105 ms because the virtual threads unmounted.',
        cpuT:'CPU work: 8 tasks, 2 threads', pool2:'pool of 2 threads', m3:'JDK 21, 2 carriers. Each task runs a 300-million-step computation. Virtual threads do not add cores, so the time stays the same.', rulesT:'When to use them',
        rules:[[1, 'Work that waits a lot: HTTP calls, databases, files. Start one virtual thread per request.'], [1, 'To limit how many requests run at once, use a `Semaphore`.'], [0, 'Do not pool virtual threads. They are cheap, so start a new one for each task.'], [0, 'They do not speed up heavy computation: the number of cores stays the same.'], [0, 'In Java 21, a long wait inside `synchronized` holds the carrier. Use `ReentrantLock` or move to Java 24.'], [0, 'Keeping big objects in a `ThreadLocal`: a million threads means a million copies.']]},
      ch:[
        ['Platform threads are expensive', ['A normal `Thread` is an operating system thread. It has its own stack, and creating it and switching between threads costs a lot.', 'That is why servers use thread pools. But a pooled thread that waits for a response does nothing. With 200 threads, only 200 requests can wait at the same time.', 'Java 21 added virtual threads. They are the JVM’s own threads, and you can create millions of them.']],
        ['Mount and unmount', ['A virtual thread does not run on the CPU by itself. A few platform threads run it. They are called carriers, and they live in a `ForkJoinPool`.', 'When a virtual thread waits on `sleep`, a socket or a lock, it unmounts from its carrier: its stack moves to the heap and the carrier takes the next virtual thread.', 'When the wait ends, the virtual thread goes back to the queue and continues on any free carrier. Switch the mode and compare the times.']],
        ['Pinning', ['In Java 21 a virtual thread cannot unmount inside `synchronized`, because the monitor belongs to the carrier thread. This is called pinning: while it waits, the carrier waits too.', 'The same happens inside a native method. `-Djdk.tracePinnedThreads=short` shows where it happens.', 'In Java 21 the fix is `ReentrantLock`. Since Java 24 (JEP 491), `synchronized` no longer pins.']],
        ['Where they do not help', ['Virtual threads make waiting cheap, but they do not make computation faster. For CPU work, one thread per core is enough.', 'They are just cheap threads. To limit how much runs at once, use a `Semaphore`, not a pool.']],
      ]},
  },
};
