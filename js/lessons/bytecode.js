/* ---------- Bytecode: real javap output, run by a small stack machine ---------- */
const BC_M = {
  addVars:{sig:'static int addVars()', names:['a', 'b', 'c'], java:['static int addVars() {', '  int a = 2;', '  int b = 3;', '  int c = a + b;', '  return c;', '}'],
    code:[[0,'iconst_2',1],[1,'istore_0',1],[2,'iconst_3',2],[3,'istore_1',2],[4,'iload_0',3],[5,'iload_1',3],[6,'iadd',3],[7,'istore_2',3],[8,'iload_2',4],[9,'ireturn',4]]},
  fold:{sig:'static int fold()', names:['x'], java:['static int fold() {', '  int x = 1 + 2;', '  return x;', '}'],
    code:[[0,'iconst_3',1],[1,'istore_0',1],[2,'iload_0',2],[3,'ireturn',2]]},
  post:{sig:'static int post()', names:['i'], java:['static int post() {', '  int i = 5;', '  i = i++;', '  return i;', '}'],
    code:[[0,'iconst_5',1],[1,'istore_0',1],[2,'iload_0',2],[3,'iinc 0, 1',2],[6,'istore_0',2],[7,'iload_0',3],[8,'ireturn',3]]},
  pre:{sig:'static int pre()', names:['i'], java:['static int pre() {', '  int i = 5;', '  i = ++i;', '  return i;', '}'],
    code:[[0,'iconst_5',1],[1,'istore_0',1],[2,'iinc 0, 1',2],[5,'iload_0',2],[6,'istore_0',2],[7,'iload_0',3],[8,'ireturn',3]]},
  loop:{sig:'static int loop()', names:['sum', 'i'], java:['static int loop() {', '  int sum = 0;', '  for (int i = 1; i <= 3; i++) {', '    sum += i;', '  }', '  return sum;', '}'],
    code:[[0,'iconst_0',1],[1,'istore_0',1],[2,'iconst_1',2],[3,'istore_1',2],[4,'iload_1',2],[5,'iconst_3',2],[6,'if_icmpgt 19',2],[9,'iload_0',3],[10,'iload_1',3],[11,'iadd',3],[12,'istore_0',3],[13,'iinc 1, 1',2],[16,'goto 4',2],[19,'iload_0',5],[20,'ireturn',5]]},
  sq:{sig:'static int sq(int)', names:['n'], java:['static int sq(int n) {', '  return n * n;', '}'],
    code:[[0,'iload_0',1],[1,'iload_0',1],[2,'imul',1],[3,'ireturn',1]]},
  call:{sig:'static int call()', names:['r'], java:['static int call() {', '  int r = sq(4);', '  return r + 1;', '}'],
    code:[[0,'iconst_4',1],[1,'invokestatic sq',1],[4,'istore_0',1],[5,'iload_0',2],[6,'iconst_1',2],[7,'iadd',2],[8,'ireturn',2]]},
  fin:{sig:'static int fin()', names:['x', 'saved', 'ex'], java:['static int fin() {', '  int x = 1;', '  try {', '    return x;', '  } finally {', '    x = 2;', '  }', '}'],
    code:[[0,'iconst_1',1],[1,'istore_0',1],[2,'iload_0',3],[3,'istore_1',3],[4,'iconst_2',5],[5,'istore_0',5],[6,'iload_1',3],[7,'ireturn',3],[8,'astore_2',5],[9,'iconst_2',5],[10,'istore_0',5],[11,'aload_2',5],[12,'athrow',5]]},
  box:{sig:'static Integer box()', names:['b', 'c'], java:['static Integer box() {', '  Integer b = 4;', '  int c = b + 1;', '  return c;', '}'],
    code:[[0,'iconst_4',1],[1,'invokestatic Integer.valueOf',1],[4,'astore_0',1],[5,'aload_0',2],[6,'invokevirtual Integer.intValue',2],[9,'iconst_1',2],[10,'iadd',2],[11,'istore_1',2],[12,'iload_1',3],[13,'invokestatic Integer.valueOf',3],[16,'areturn',3]]},
};
const bcFrame = n => ({m:n, i:0, loc:[], st:[]});
const bcShow = v => v === undefined ? '' : typeof v === 'object' ? `Integer(${v.box})` : String(v);
function bcRun(name) {
  const fr = [bcFrame(name)], snaps = [], clone = () => fr.map(f => ({m:f.m, i:f.i, loc:f.loc.slice(), st:f.st.slice()}));
  let ret, guard = 0;
  snaps.push({fr:clone(), ev:null});
  while (fr.length && guard++ < 300) {
    const f = fr[fr.length - 1], ins = BC_M[f.m].code[f.i], t = ins[1], m = BC_M[f.m];
    let ev = [t], jump = null;
    let x;
    if ((x = /^iconst_(\d)$/.exec(t))) { f.st.push(+x[1]); ev = ['push', +x[1]]; }
    else if ((x = /^[ia]store_(\d)$/.exec(t))) { const v = f.st.pop(); f.loc[+x[1]] = v; ev = ['store', bcShow(v), m.names[+x[1]], +x[1]]; }
    else if ((x = /^[ia]load_(\d)$/.exec(t))) { const v = f.loc[+x[1]]; f.st.push(v); ev = ['load', bcShow(v), m.names[+x[1]], +x[1]]; }
    else if (t === 'iadd' || t === 'imul') { const b = f.st.pop(), a = f.st.pop(), r = t === 'iadd' ? a + b : a * b; f.st.push(r); ev = [t, a, b, r]; }
    else if ((x = /^iinc (\d), (-?\d+)$/.exec(t))) { f.loc[+x[1]] += +x[2]; ev = ['iinc', m.names[+x[1]], f.loc[+x[1]]]; }
    else if ((x = /^if_icmpgt (\d+)$/.exec(t))) { const b = f.st.pop(), a = f.st.pop(); if (a > b) { jump = +x[1]; ev = ['jumpYes', a, b]; } else ev = ['jumpNo', a, b]; }
    else if ((x = /^goto (\d+)$/.exec(t))) { jump = +x[1]; ev = ['goto', +x[1]]; }
    else if (t === 'invokestatic sq') { const a = f.st.pop(); f.i++; const nf = bcFrame('sq'); nf.loc[0] = a; fr.push(nf); snaps.push({fr:clone(), ev:['call', a], at:[f.m, f.i - 1]}); continue; }
    else if (t === 'invokestatic Integer.valueOf') { const a = f.st.pop(); f.st.push({box:a}); ev = ['valueOf', a]; }
    else if (t === 'invokevirtual Integer.intValue') { const a = f.st.pop(); f.st.push(a.box); ev = ['intValue', a.box]; }
    else if (t === 'ireturn' || t === 'areturn') {
      const v = f.st.pop(); fr.pop();
      if (fr.length) { fr[fr.length - 1].st.push(v); ev = ['retTo', bcShow(v)]; } else { ret = v; ev = ['ret', bcShow(v)]; }
      snaps.push({fr:clone(), ev, at:[f.m, f.i], ret:fr.length ? undefined : v});
      continue;
    }
    else throw new Error('bytecode op ' + t);
    const at = [f.m, f.i];
    if (jump !== null) f.i = m.code.findIndex(c => c[0] === jump); else f.i++;
    snaps.push({fr:clone(), ev, at});
  }
  return {snaps, ret};
}
const BC_CH = ['addVars', 'fold', 'post', 'loop', 'call', 'fin', 'box'];
LS.bytecode = {
  init(i) { return {i:0, m:BC_CH[i]}; },
  controls(st, ch) {
    const n = bcRun(st.m).snaps.length - 1;
    return lsStepper(st.i, n, ch === 2 ? `<button class="btn" type="button" data-act="swap"><code class="bare">${st.m === 'post' ? 'i = ++i' : 'i = i++'}</code></button>` : '');
  },
  stage(st, ch) {
    const run = bcRun(st.m), sn = run.snaps[st.i], fr = sn.fr;
    const top = fr[fr.length - 1], curM = sn.at && !top ? sn.at[0] : top ? top.m : st.m;
    const shown = sn.at ? sn.at[0] : top.m;
    const nextIdx = top && top.m === shown ? top.i : -1;
    const lastI = sn.at && sn.at[0] === shown ? BC_M[shown].code.findIndex((c, j) => j === sn.at[1]) : -1;
    const m = BC_M[shown];
    const list = `<ol class="bcv">${m.code.map((c, j) => `<li class="${j === lastI ? 'done' : ''}${j === nextIdx ? ' on' : ''}"><span>${c[0]}</span><code class="bare">${esc(c[1].replace('invokestatic ', 'invokestatic ').replace('Integer.valueOf', 'Integer.valueOf:(I)'))}</code></li>`).join('')}</ol>`;
    const srcLine = lastI >= 0 ? m.code[lastI][2] : -1;
    const frames = fr.length ? fr.slice().reverse().map(f => {
      const mm = BC_M[f.m];
      const loc = mm.names.map((n, s) => `<div class="bcslot"><span>${s}: ${esc(n)}</span><i class="${f.loc[s] === undefined ? 'emp' : 'val'}">${f.loc[s] === undefined ? '-' : esc(bcShow(f.loc[s]))}</i></div>`).join('');
      const stack = f.st.length ? f.st.slice().reverse().map(v => `<div class="bcop"><i class="val">${esc(bcShow(v))}</i></div>`).join('') : `<p class="muted small">${esc(lu('emptyOp'))}</p>`;
      return `<div class="bcframe"><h3><code class="bare">${esc(mm.sig)}</code></h3><div class="bcfi"><div><h4>Local variables</h4>${loc}</div><div><h4>Operand stack</h4>${stack}</div></div></div>`;
    }).join('') : `<p class="verdict ok">${rich(ls$('finished', bcShow(run.ret)))}</p>`;
    const caption = sn.ev ? ls$('e_' + sn.ev[0], ...sn.ev.slice(1)) : lu('pressNext');
    return `<div class="bcgrid">${pnl('Java', codeBlock(m.java, srcLine))}${pnl('javap -c', list + (st.m === 'fin' ? `<p class="muted small">${rich(lu('table'))}</p>` : ''))}</div>`
      + pnl(lu('frames'), frames + `<p class="explain-s">${rich(caption)}</p>`)
      + pnl('', measured(rich(ls$('real', bcShow(run.ret)))));
  },
  act(st, a, v, ch) {
    const n = bcRun(st.m).snaps.length - 1;
    if (a === 'next') st.i = Math.min(n, st.i + 1);
    if (a === 'prev') st.i = Math.max(0, st.i - 1);
    if (a === 'reset') st.i = 0;
    if (a === 'swap') { st.m = st.m === 'post' ? 'pre' : 'post'; st.i = 0; }
  },
  text: {
    az: {title:'Bytecode', door:'javac nə yazır? Operand stack, local variable-lar, i = i++ tələsi və finally-nin həqiqi forması.',
      ui:{frames:'Frame', emptyOp:'boşdur', pressNext:'Növbəti düyməsini bas: JVM bir instruction işlədəcək.', finished:v => `Method bitdi və ${v} qaytardı.`, real:v => `Listing \`javap -c\` çıxışıdır (JDK 21). Real \`java\` də eyni nəticəni verdi: ${v}.`, table:'Exception table: 2-dən 4-ə qədər hər exception 8-ə gedir (`any`).',
        e_push:v => `\`${v}\` operand stack-in üstünə qoyuldu.`, e_store:(v, n, s) => `Stack-in üstündəki ${v} götürüldü və ${s}-ci slot-a (\`${n}\`) yazıldı.`, e_load:(v, n) => `\`${n}\`-in dəyəri (${v}) stack-ə kopyalandı. \`${n}\` dəyişmədi.`, e_iadd:(a, b, r) => `İki dəyər götürüldü: ${a} + ${b} = ${r}. Nəticə stack-ə qoyuldu.`, e_imul:(a, b, r) => `İki dəyər götürüldü: ${a} × ${b} = ${r}. Nəticə stack-ə qoyuldu.`, e_iinc:(n, v) => `\`iinc\` birbaşa \`${n}\`-i artırdı: indi ${v}. Stack-ə toxunmadı.`, e_jumpYes:(a, b) => `${a} > ${b} doğrudur: dövrədən çıxılır.`, e_jumpNo:(a, b) => `${a} > ${b} səhvdir: dövrə davam edir.`, e_goto:p => `${p}-ə qayıdılır: şərt yenidən yoxlanacaq.`, e_call:a => `Yeni frame yarandı. Arqument ${a} stack-dən yeni frame-in 0-cı slot-una keçdi.`, e_retTo:v => `Frame silindi, ${v} çağıran method-un stack-inə qoyuldu.`, e_ret:v => `\`ireturn\`: frame silindi, nəticə ${v}.`, e_valueOf:a => `Autoboxing: \`Integer.valueOf(${a})\` çağırıldı.`, e_intValue:a => `Unboxing: \`intValue()\` ${a} qaytardı.`},
      ch:[
        ['JVM bir stack machine-dir', ['`javac` Java-nı bytecode-a çevirir, `javap -c` onu göstərir. CPU register-ləri əvəzinə JVM hər frame-də kiçik bir operand stack işlədir.', 'Hər instruction dəyəri stack-ə qoyur və ya oradan götürür. `a + b` üçün iki dəyər qoyulur, `iadd` onları götürüb nəticəni qoyur.', 'Local variable-ların adı yoxdur, slot nömrəsi var: `istore_0` 0-cı slot-a yazır.']],
        ['javac əvvəlcədən hesablayır', ['Burada `1 + 2` yazılıb, amma bytecode-da toplama yoxdur: `iconst_3`. Sabit ifadəni compiler özü hesablayır.', 'Eyni qayda `"a" + "b"` üçün də keçərlidir: nəticə bir literal olur. Ona görə `"ab" == "a" + "b"` `true`-dur.']],
        ['i = i++ tələsi', ['Bu kod `i`-ni dəyişmir, nəticə 5-dir. Addımlara bax: `iload_0` köhnə 5-i stack-ə qoyur, `iinc` `i`-ni 6 edir, `istore_0` isə köhnə 5-i geri yazır.', 'Düymə ilə `i = ++i`-yə keç: sıra dəyişir, əvvəl `iinc`, sonra `iload_0`. Nəticə 6 olur.']],
        ['Dövrə: if və goto', ['Bytecode-da `for` yoxdur, şərtli və şərtsiz keçid var. `if_icmpgt` stack-dən iki dəyər götürür və müqayisə edir, `goto` geri qayıdır.', 'Diqqət et: şərt tərsinədir. `i <= 3` üçün “`i > 3`-dürsə, çıx” yazılıb.']],
        ['Method çağırışı: yeni frame', ['Çağıran method arqumenti stack-ə qoyur. `invokestatic` yeni frame yaradır və dəyər onun 0-cı slot-una keçir.', '`ireturn` frame-i silir və nəticəni çağıranın operand stack-inə qoyur. Stack overflow bu frame-lərin dolmasıdır.']],
        ['finally necə işləyir?', ['Bu method 2 yox, 1 qaytarır. `javac` qaytarılacaq dəyəri əvvəlcə ayrıca slot-a yazır (`saved`), sonra `finally` kodunu işlədir, sonra `saved`-i qaytarır.', '`finally` bytecode-da ayrıca blok deyil: kod hər çıxış yoluna kopyalanır. Exception yolu 8-ci sətirdən başlayır, burada exception olmadığı üçün işləmir.']],
        ['Autoboxing görünür', ['Java kodunda `Integer.valueOf` yazılmayıb, amma bytecode-da var. `Integer b = 4` əslində `Integer.valueOf(4)`-dür, `Integer` cache də buradan işləyir.', '`b + 1` üçün əvvəl `intValue()` çağırılır. `b` `null` olsaydı, `NullPointerException` burada yaranardı.', 'String birləşməsi də oxşardır: `a + "!"` `invokedynamic` ilə `makeConcatWithConstants` olur.']],
      ]},
    tr: {title:'Bytecode', door:"javac ne yazar? Operand stack, local variable'lar, i = i++ tuzağı ve finally'nin gerçek hali.",
      ui:{frames:'Frame', emptyOp:'boş', pressNext:'Sonraki düğmesine bas: JVM bir instruction çalıştıracak.', finished:v => `Method bitti ve ${v} döndürdü.`, real:v => `Listing \`javap -c\` çıktısıdır (JDK 21). Gerçek \`java\` de aynı sonucu verdi: ${v}.`, table:"Exception table: 2'den 4'e kadar her exception 8'e gider (`any`).",
        e_push:v => `\`${v}\` operand stack'in üstüne kondu.`, e_store:(v, n, s) => `Stack'in üstündeki ${v} alındı ve ${s}. slot'a (\`${n}\`) yazıldı.`, e_load:(v, n) => `\`${n}\` değeri (${v}) stack'e kopyalandı. \`${n}\` değişmedi.`, e_iadd:(a, b, r) => `İki değer alındı: ${a} + ${b} = ${r}. Sonuç stack'e kondu.`, e_imul:(a, b, r) => `İki değer alındı: ${a} × ${b} = ${r}. Sonuç stack'e kondu.`, e_iinc:(n, v) => `\`iinc\` doğrudan \`${n}\` değerini artırdı: şimdi ${v}. Stack'e dokunmadı.`, e_jumpYes:(a, b) => `${a} > ${b} doğru: döngüden çıkılıyor.`, e_jumpNo:(a, b) => `${a} > ${b} yanlış: döngü devam ediyor.`, e_goto:p => `${p} konumuna dönülüyor: koşul yeniden kontrol edilecek.`, e_call:a => `Yeni frame oluştu. Argüman ${a} stack'ten yeni frame'in 0. slot'una geçti.`, e_retTo:v => `Frame silindi, ${v} çağıran method'un stack'ine kondu.`, e_ret:v => `\`ireturn\`: frame silindi, sonuç ${v}.`, e_valueOf:a => `Autoboxing: \`Integer.valueOf(${a})\` çağrıldı.`, e_intValue:a => `Unboxing: \`intValue()\` ${a} döndürdü.`},
      ch:[
        ['JVM bir stack machine\'dir', ["`javac` Java'yı bytecode'a çevirir, `javap -c` onu gösterir. CPU register'ları yerine JVM her frame'de küçük bir operand stack kullanır.", "Her instruction değeri stack'e koyar veya oradan alır. `a + b` için iki değer konur, `iadd` onları alıp sonucu koyar.", "Local variable'ların adı yoktur, slot numarası vardır: `istore_0` 0. slot'a yazar."]],
        ['javac önceden hesaplar', ["Burada `1 + 2` yazıyor, ama bytecode'da toplama yok: `iconst_3`. Sabit ifadeyi compiler kendisi hesaplar.", "Aynı kural `\"a\" + \"b\"` için de geçerlidir: sonuç tek literal olur. Bu yüzden `\"ab\" == \"a\" + \"b\"` `true` olur."]],
        ['i = i++ tuzağı', ["Bu kod `i` değerini değiştirmez, sonuç 5'tir. Adımlara bak: `iload_0` eski 5'i stack'e koyar, `iinc` `i` değerini 6 yapar, `istore_0` ise eski 5'i geri yazar.", "Düğmeyle `i = ++i` kodlarına geç: sıra değişir, önce `iinc`, sonra `iload_0`. Sonuç 6 olur."]],
        ['Döngü: if ve goto', ["Bytecode'da `for` yoktur, koşullu ve koşulsuz geçiş vardır. `if_icmpgt` stack'ten iki değer alır ve karşılaştırır, `goto` geri döner.", 'Dikkat et: koşul terstir. `i <= 3` için “`i > 3` ise çık” yazılır.']],
        ['Method çağrısı: yeni frame', ["Çağıran method argümanı stack'e koyar. `invokestatic` yeni frame oluşturur ve değer onun 0. slot'una geçer.", "`ireturn` frame'i siler ve sonucu çağıranın operand stack'ine koyar. Stack overflow bu frame'lerin dolmasıdır."]],
        ['finally nasıl çalışır?', ["Bu method 2 değil, 1 döndürür. `javac` döndürülecek değeri önce ayrı bir slot'a yazar (`saved`), sonra `finally` kodunu çalıştırır, sonra `saved` değerini döndürür.", "`finally` bytecode'da ayrı bir blok değildir: kod her çıkış yoluna kopyalanır. Exception yolu 8. satırdan başlar, burada exception olmadığı için çalışmaz."]],
        ['Autoboxing görünür', ["Java kodunda `Integer.valueOf` yazmıyor, ama bytecode'da var. `Integer b = 4` aslında `Integer.valueOf(4)` çağrısıdır, `Integer` cache de buradan çalışır.", "`b + 1` için önce `intValue()` çağrılır. `b` `null` olsaydı `NullPointerException` burada oluşurdu.", "String birleştirme de benzerdir: `a + \"!\"`, `invokedynamic` ile `makeConcatWithConstants` olur."]],
      ]},
    en: {title:'Bytecode', door:'What does javac write? The operand stack, local variables, the i = i++ trap and what finally really is.',
      ui:{frames:'Frame', emptyOp:'empty', pressNext:'Press Next: the JVM runs one instruction.', finished:v => `The method finished and returned ${v}.`, real:v => `The listing is real \`javap -c\` output (JDK 21). Real \`java\` gave the same result: ${v}.`, table:'Exception table: any exception from 2 to 4 goes to 8 (`any`).',
        e_push:v => `\`${v}\` was pushed onto the operand stack.`, e_store:(v, n, s) => `${v} was popped and stored in slot ${s} (\`${n}\`).`, e_load:(v, n) => `The value of \`${n}\` (${v}) was copied onto the stack. \`${n}\` did not change.`, e_iadd:(a, b, r) => `Two values were popped: ${a} + ${b} = ${r}. The result was pushed.`, e_imul:(a, b, r) => `Two values were popped: ${a} × ${b} = ${r}. The result was pushed.`, e_iinc:(n, v) => `\`iinc\` increased \`${n}\` directly: now ${v}. The stack was not touched.`, e_jumpYes:(a, b) => `${a} > ${b} is true: the loop ends.`, e_jumpNo:(a, b) => `${a} > ${b} is false: the loop goes on.`, e_goto:p => `Back to ${p}: the condition is checked again.`, e_call:a => `A new frame was created. The argument ${a} moved from the stack to slot 0 of the new frame.`, e_retTo:v => `The frame was removed and ${v} went onto the stack of the caller.`, e_ret:v => `\`ireturn\`: the frame was removed, result ${v}.`, e_valueOf:a => `Autoboxing: \`Integer.valueOf(${a})\` was called.`, e_intValue:a => `Unboxing: \`intValue()\` returned ${a}.`},
      ch:[
        ['The JVM is a stack machine', ['`javac` turns Java into bytecode and `javap -c` shows it. Instead of CPU registers, the JVM uses a small operand stack in each frame.', 'Every instruction pushes a value or pops one. For `a + b`, two values are pushed, and `iadd` pops them and pushes the result.', 'Local variables have no names, only slot numbers: `istore_0` writes to slot 0.']],
        ['javac calculates ahead', ['The code says `1 + 2`, but the bytecode has no addition: `iconst_3`. The compiler works out constant expressions itself.', 'The same goes for `"a" + "b"`: the result is one literal. That is why `"ab" == "a" + "b"` is `true`.']],
        ['The i = i++ trap', ['This code does not change `i`: the result is 5. Follow the steps: `iload_0` pushes the old 5, `iinc` makes `i` 6, and `istore_0` writes the old 5 back.', 'Switch to `i = ++i` with the button: the order changes, `iinc` first, then `iload_0`. The result is 6.']],
        ['A loop: if and goto', ['Bytecode has no `for`, only conditional and unconditional jumps. `if_icmpgt` pops two values and compares them, and `goto` jumps back.', 'Note that the condition is inverted: `i <= 3` is written as "leave if `i > 3`".']],
        ['A method call: a new frame', ['The caller pushes the argument. `invokestatic` creates a new frame, and the value moves to its slot 0.', '`ireturn` removes the frame and pushes the result onto the operand stack of the caller. A stack overflow is these frames filling up.']],
        ['How does finally work?', ['This method returns 1, not 2. `javac` first stores the return value in a separate slot (`saved`), then runs the `finally` code, then returns `saved`.', '`finally` is not a separate block in bytecode: its code is copied into every exit path. The exception path starts at line 8 and does not run here, as there is no exception.']],
        ['Autoboxing becomes visible', ['The Java code has no `Integer.valueOf`, but the bytecode does. `Integer b = 4` is really `Integer.valueOf(4)`, and that is where the `Integer` cache works.', 'For `b + 1`, `intValue()` is called first. If `b` were `null`, the `NullPointerException` would come from here.', 'String concatenation is similar: `a + "!"` becomes `makeConcatWithConstants` through `invokedynamic`.']],
      ]},
  },
};
