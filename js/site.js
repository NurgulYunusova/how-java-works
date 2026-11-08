/* ---------- Site: topics and the HashMap lesson ---------- */
const SITE = {
  az: {site:'Java necə işləyir', siteLede:'Mövzu seç, kod yaz və daxildə nə baş verdiyini addım-addım gör.', topics:'Mövzular', gMem:"Memory", gColl:"Collection-lar", gConc:"Concurrency", gHood:"Dil və JVM",
    doorJvm:'JVM: Stack və Heap', doorJvmText:'Primitive-lər, object-lər, String Pool, frame-lər və GC. Kodun memory-də hara düşdüyünü sətir-sətir izlə.',
    doorHm:'HashMap necə işləyir', doorHmText:'hashCode, bucket, collision və resize. Key-in table-dakı yerini necə tapdığını bit-bit izlə.',
    hmTitle:'HashMap necə işləyir', section:'Bölmə', tryIt:'Özün yoxla', fKey:'Key (String)', fVal:'Value (int)', clear:'Təmizlə', openJvm:'JVM xəritəsində aç',
    pipe:'Key-in yolu', table:'Table', notes:'Bu addımda', code:'Java kodu', pipeEmpty:'Solda key yaz və put düyməsini bas.',
    nullKey:'null key-in hash-i həmişə 0-dır.', tableNull:'table hələ null-dur: ilk put-da yaranacaq.', errKey:'Key yaz.', errVal:'Value int olmalıdır, məsələn 20.', errMany:'Çox əməliyyat oldu. Təmizlə düyməsini bas.',
    diffHash:'hash fərqlidir', eqFalse:'equals false', eqTrue:'equals true', moved:n => `${n} Node yerini dəyişdi`, tree:'real JVM: TreeNode', calc:'Hesablama', noSpread:'spread olmasa', withSpread:'spread ilə', bucket:'bucket'},
  tr: {site:'Java nasıl çalışır', siteLede:'Konu seç, kod yaz ve içeride ne olduğunu adım adım gör.', topics:'Konular', gMem:"Memory", gColl:"Collection'lar", gConc:"Concurrency", gHood:"Dil ve JVM",
    doorJvm:'JVM: Stack ve Heap', doorJvmText:"Primitive'ler, object'ler, String Pool, frame'ler ve GC. Kodunun memory'de nereye düştüğünü satır satır izle.",
    doorHm:'HashMap nasıl çalışır', doorHmText:"hashCode, bucket, collision ve resize. Key'in table'daki yerini nasıl bulduğunu bit bit izle.",
    hmTitle:'HashMap nasıl çalışır', section:'Bölüm', tryIt:'Kendin dene', fKey:'Key (String)', fVal:'Value (int)', clear:'Temizle', openJvm:'JVM haritasında aç',
    pipe:"Key'in yolu", table:'Table', notes:'Bu adımda', code:'Java kodu', pipeEmpty:'Solda key yaz ve put düğmesine bas.',
    nullKey:"null key'in hash'i her zaman 0'dır.", tableNull:'table hâlâ null: ilk put çağrısında oluşacak.', errKey:'Key yaz.', errVal:'Value int olmalı, örneğin 20.', errMany:'Çok fazla işlem oldu. Temizle düğmesine bas.',
    diffHash:'hash farklı', eqFalse:'equals false', eqTrue:'equals true', moved:n => `${n} Node yer değiştirdi`, tree:'gerçek JVM: TreeNode', calc:'Hesaplama', noSpread:'spread olmasa', withSpread:'spread ile', bucket:'bucket'},
  en: {site:'How Java works', siteLede:'Pick a topic, write code and watch what happens inside, step by step.', topics:'Topics', gMem:"Memory", gColl:"Collections", gConc:"Concurrency", gHood:"Language and JVM",
    doorJvm:'JVM: Stack and Heap', doorJvmText:'Primitives, objects, the String Pool, frames and GC. Follow line by line where your code lands in memory.',
    doorHm:'How HashMap works', doorHmText:'hashCode, buckets, collisions and resize. Follow bit by bit how a key finds its place in the table.',
    hmTitle:'How HashMap works', section:'Section', tryIt:'Try it yourself', fKey:'Key (String)', fVal:'Value (int)', clear:'Clear', openJvm:'Open in the JVM map',
    pipe:'The path of the key', table:'Table', notes:'In this step', code:'Java code', pipeEmpty:'Type a key on the left and press put.',
    nullKey:'The hash of a null key is always 0.', tableNull:'table is still null: it appears on the first put.', errKey:'Type a key.', errVal:'Value must be an int, for example 20.', errMany:'Too many operations. Press Clear.',
    diffHash:'different hash', eqFalse:'equals false', eqTrue:'equals true', moved:n => `${n} Nodes moved`, tree:'real JVM: TreeNode', calc:'Calculation', noSpread:'without spread', withSpread:'with spread', bucket:'bucket'},
};
const s = k => SITE[LANG][k];
const P = (key, val) => ({op:'put', key, val});
const TREE_KEYS = ['AaAaAaAa','AaAaAaBB','AaAaBBAa','AaAaBBBB','AaBBAaAa','AaBBAaBB','AaBBBBAa','AaBBBBBB','BBAaAaAa','BBAaAaBB','BBAaBBAa'];
/* Each section sets up the map with real operations, so the picture always comes from the engine. */
const HM_OPS = [
  [P('Aysel', 20), P('Leyla', 25), P('Nigar', 30), {op:'get', key:'Leyla'}],
  [P('salam', 1)],
  [P('salam', 1)],
  [P('salam', 1)],
  [P('Aa', 1), P('BB', 2)],
  [P('Aa', 1), P('BB', 2), {op:'get', key:'BB'}],
  [P('Aysel', 20), P('Aysel', 21)],
  ['Aysel','Leyla','Nigar','Murad','Kamran','Orxan','Ramin','Samir','Farid','Aytac','Gunel','Sevda','Tural'].map((k, i) => P(k, i + 1)),
  TREE_KEYS.map((k, i) => P(k, i + 1)),
  [P('c', 1), P('a', 2), P('b', 3), P(null, 4), {op:'print'}],
];
const HM_FLAGS = [{}, {calc:true}, {spread:true}, {}, {}, {}, {}, {}, {}, {}];
const HM_TEXT = {
  az: [
    ['Niyə HashMap?', ['Array-də bir key-i tapmaq üçün element-ləri bir-bir yoxlamaq lazımdır. 1 milyon element varsa, 1 milyon yoxlama ola bilər: `O(n)`.', 'HashMap key-dən birbaşa index hesablayır və həmin bucket-ə gedir. Element sayı artsa da, yoxlama sayı adətən dəyişmir: orta hesabla `O(1)`.', 'Sağda `get("Leyla")`-nın yolunu görürsən: key, `hashCode()`, `hash`, `index`, bucket.']],
    ['hashCode: key-dən number', ['`String.hashCode()` hər character-i bu formula ilə toplayır: `h = 31 * h + c`. Burada `c` character-in kodudur.', 'Eyni String həmişə eyni number verir. Nəticə `int`-dir, overflow olanda mənfi də ola bilər.', 'Solda başqa key yaz və sağda hesablamanın necə dəyişdiyinə bax.']],
    ['spread: yuxarı bit-ləri qarışdırmaq', ['`index` yalnız aşağı bit-ləri işlədir: `n = 16` üçün son 4 bit. Spread olmasa, yalnız yuxarı bit-ləri fərqli olan key-lər eyni bucket-ə düşərdi.', 'Ona görə HashMap `hash = h ^ (h >>> 16)` hesablayır: yuxarı 16 bit aşağı 16 bit-ə qarışır.', 'Aşağıdakı `Integer` key-lərdə fərqi görürsən:']],
    ['index: bucket-in yeri', ['`index = (n - 1) & hash`. Burada `n` capacity-dir və həmişə 2-nin qüvvətidir: 16, 32, 64. `new HashMap<>(20)` yazsan da, capacity 32 olur.', 'Ona görə `n - 1`-in aşağı bit-lərinin hamısı 1-dir (15 = 1111) və `&` yalnız hash-in son bit-lərini saxlayır.', 'Nəticə həmişə `0` ilə `n - 1` arasındadır, hash mənfi olsa belə.']],
    ['Collision', ['Fərqli key-lər eyni bucket-ə düşə bilər. `"Aa"` və `"BB"`-nin `hashCode`-u eynidir: 2112.', 'Bucket-də artıq Node varsa, yeni Node zəncirin sonuna `next` ilə bağlanır. Heç nə silinmir, array də dəyişmir.', 'Solda `AaAa` və `BBBB` yaz: onların da hash-i eynidir.']],
    ['get və equals', ['`get` eyni yolla bucket-i tapır, sonra zəncirdə gəzir. Hər Node üçün əvvəl `hash`, sonra `==` və ya `equals` yoxlanır.', 'Sağda hər Node-un yanında yoxlamanın nəticəsi yazılıb.', 'Ona görə öz class-ını key edəndə `equals` və `hashCode`-u birlikdə yazmalısan. Biri olmasa, eyni məzmunlu key tapılmaya bilər.']],
    ['Eyni key-ə put', ['Key artıq varsa, yeni Node yaranmır: mövcud Node-un `value`-su dəyişir, `size` artmır.', '`put` köhnə value-nu qaytarır. Key-in özü dəyişmir.']],
    ['resize', ['Table ilk `put`-da yaranır. Default capacity 16, load factor 0.75-dir, ona görə `threshold` 12-dir.', '`size` threshold-u keçəndə, yəni 13-cü element-də, capacity 2 dəfə artır. Yeni array yaranır, Node-lar ora köçürülür.', '`hash` yenidən hesablanmır, Node-da saxlanır. Yeni bir bit yoxlanır: `hash & oldCap` 0-dırsa index qalır, deyilsə `index + oldCap` olur. Yerini dəyişən Node-lar sağda işarələnib.']],
    ['Zəncir uzananda: tree', ['Bir bucket-də Node çoxalanda axtarış yavaşlayır. Zəncir 8 Node-u keçəndə capacity 64-dən kiçikdirsə, əvvəl resize olur. Capacity 64 və ya daha böyükdürsə, bucket red-black tree-yə çevrilir və axtarış `O(log n)` olur.', 'Burada 11 key-in hash-i eynidir: 9-cu key-də capacity 32, 10-cu key-də 64 oldu, 11-ci key-də bucket tree-yə çevrilir.', 'Resize zamanı Node sayı 6 və ya daha az qalan bucket yenidən list olur. Bu alət tree-ni list kimi çəkir və bucket-i `TreeNode` nişanı ilə göstərir.']],
    ['Bilməli olduğun tələlər', ['Sıra zəmanət deyil: element-lər bucket sırası ilə gəzilir. Sağdakı çıxışa bax. Əlavə etmə sırası lazımdırsa, `LinkedHashMap` işlət.', '`null` key olar: hash-i 0-dır və bucket 0-a düşür.', 'Thread-safe deyil: bir neçə thread üçün `ConcurrentHashMap` işlət.', 'Key-i dəyişmə: map-ə girəndən sonra `hashCode`-u dəyişsə, Node köhnə bucket-də qalır və key tapılmır. Ona görə `String` kimi immutable key-lər yaxşıdır.']],
  ],
  tr: [
    ['Neden HashMap?', ["Array'de bir key'i bulmak için element'leri tek tek kontrol etmek gerekir. 1 milyon element varsa 1 milyon kontrol olabilir: `O(n)`.", "HashMap, key'den doğrudan index hesaplar ve o bucket'a gider. Element sayısı artsa da kontrol sayısı genellikle değişmez: ortalama `O(1)`.", 'Sağda `get("Leyla")` çağrısının yolunu görüyorsun: key, `hashCode()`, `hash`, `index`, bucket.']],
    ["hashCode: key'den number", ["`String.hashCode()` her character'i şu formülle toplar: `h = 31 * h + c`. Burada `c`, character'in kodudur.", "Aynı String her zaman aynı number'ı verir. Sonuç `int`'tir, overflow olunca negatif de olabilir.", 'Solda başka bir key yaz ve sağda hesaplamanın nasıl değiştiğine bak.']],
    ["spread: üst bit'leri karıştırmak", ["`index` yalnızca alt bit'leri kullanır: `n = 16` için son 4 bit. Spread olmasa, yalnızca üst bit'leri farklı olan key'ler aynı bucket'a düşerdi.", "Bu yüzden HashMap `hash = h ^ (h >>> 16)` hesaplar: üst 16 bit, alt 16 bit'e karışır.", "Aşağıdaki `Integer` key'lerde farkı görüyorsun:"]],
    ["index: bucket'ın yeri", ["`index = (n - 1) & hash`. Burada `n` capacity'dir ve her zaman 2'nin kuvvetidir: 16, 32, 64. `new HashMap<>(20)` yazsan bile capacity 32 olur.", "Bu yüzden `n - 1` değerinin alt bit'lerinin hepsi 1'dir (15 = 1111) ve `&` yalnızca hash'in son bit'lerini tutar.", 'Sonuç her zaman `0` ile `n - 1` arasındadır, hash negatif olsa bile.']],
    ['Collision', ["Farklı key'ler aynı bucket'a düşebilir. `\"Aa\"` ve `\"BB\"` için `hashCode` aynıdır: 2112.", "Bucket'ta zaten Node varsa, yeni Node zincirin sonuna `next` ile bağlanır. Hiçbir şey silinmez, array de değişmez.", "Solda `AaAa` ve `BBBB` yaz: onların da hash'i aynıdır."]],
    ['get ve equals', ["`get` aynı yolla bucket'ı bulur, sonra zincirde gezer. Her Node için önce `hash`, sonra `==` veya `equals` kontrol edilir.", "Sağda her Node'un yanında kontrolün sonucu yazıyor.", "Bu yüzden kendi class'ını key yaparken `equals` ve `hashCode` metotlarını birlikte yazmalısın. Biri olmazsa, aynı içerikli key bulunamayabilir."]],
    ["Aynı key'e put", ["Key zaten varsa yeni Node oluşmaz: mevcut Node'un `value` alanı değişir, `size` artmaz.", "`put` eski value'yu döndürür. Key'in kendisi değişmez."]],
    ['resize', ["Table ilk `put` çağrısında oluşur. Default capacity 16, load factor 0.75'tir, bu yüzden `threshold` 12'dir.", "`size` threshold'u aşınca, yani 13. element'te, capacity 2 katına çıkar. Yeni array oluşur, Node'lar oraya taşınır.", "`hash` yeniden hesaplanmaz, Node'da saklanır. Yeni bir bit kontrol edilir: `hash & oldCap` 0 ise index kalır, değilse `index + oldCap` olur. Yer değiştiren Node'lar sağda işaretli."]],
    ['Zincir uzayınca: tree', ["Bir bucket'ta Node çoğalınca arama yavaşlar. Zincir 8 Node'u geçince capacity 64'ten küçükse önce resize olur. Capacity 64 veya daha büyükse bucket red-black tree'ye çevrilir ve arama `O(log n)` olur.", "Burada 11 key'in hash'i aynı: 9. key'de capacity 32, 10. key'de 64 oldu, 11. key'de bucket tree'ye çevrilir.", "Resize sırasında Node sayısı 6 veya daha az kalan bucket yeniden list olur. Bu araç tree'yi list olarak çizer ve bucket'ı `TreeNode` etiketiyle gösterir."]],
    ['Bilmen gereken tuzaklar', ["Sıra garanti değildir: element'ler bucket sırasıyla gezilir. Sağdaki çıktıya bak. Ekleme sırası gerekiyorsa `LinkedHashMap` kullan.", "`null` key olabilir: hash'i 0'dır ve bucket 0'a düşer.", "Thread-safe değildir: birden fazla thread için `ConcurrentHashMap` kullan.", "Key'i değiştirme: map'e girdikten sonra `hashCode` değişirse Node eski bucket'ta kalır ve key bulunamaz. Bu yüzden `String` gibi immutable key'ler iyidir."]],
  ],
  en: [
    ['Why HashMap?', ['To find a key in an array you check the elements one by one. With 1 million elements that can mean 1 million checks: `O(n)`.', 'HashMap computes an index straight from the key and goes to that bucket. As the map grows, the number of checks usually stays the same: `O(1)` on average.', 'On the right is the path of `get("Leyla")`: key, `hashCode()`, `hash`, `index`, bucket.']],
    ['hashCode: from key to number', ['`String.hashCode()` adds up every character with this formula: `h = 31 * h + c`, where `c` is the code of the character.', 'The same String always gives the same number. The result is an `int`, so overflow can make it negative.', 'Type another key on the left and watch the calculation change.']],
    ['spread: mixing in the high bits', ['`index` only uses the low bits: the last 4 bits when `n = 16`. Without spread, keys that differ only in their high bits would land in the same bucket.', 'So HashMap computes `hash = h ^ (h >>> 16)`: the high 16 bits are mixed into the low 16 bits.', 'You can see the difference with these `Integer` keys:']],
    ['index: the place of the bucket', ['`index = (n - 1) & hash`, where `n` is the capacity, always a power of 2: 16, 32, 64. Even `new HashMap<>(20)` gets capacity 32.', 'That makes all the low bits of `n - 1` equal to 1 (15 = 1111), so `&` keeps only the last bits of the hash.', 'The result is always between `0` and `n - 1`, even when the hash is negative.']],
    ['Collision', ['Different keys can land in the same bucket. `"Aa"` and `"BB"` have the same `hashCode`: 2112.', 'If the bucket already has a Node, the new Node is linked to the end of the chain through `next`. Nothing is removed and the array does not change.', 'Type `AaAa` and `BBBB` on the left: they share a hash too.']],
    ['get and equals', ['`get` finds the bucket the same way, then walks the chain. For each Node it checks `hash` first, then `==` or `equals`.', 'On the right, each Node shows the result of its check.', 'That is why your own key class needs `equals` and `hashCode` together. Without both, a key with the same content may not be found.']],
    ['put on an existing key', ['If the key already exists, no new Node is created: the `value` of the existing Node changes and `size` stays the same.', '`put` returns the old value. The key itself does not change.']],
    ['resize', ['The table is created on the first `put`. The default capacity is 16 and the load factor is 0.75, so `threshold` is 12.', 'When `size` passes the threshold, on the 13th element, capacity doubles. A new array is created and the Nodes move into it.', '`hash` is not recalculated, because the Node stores it. One new bit is checked: if `hash & oldCap` is 0 the index stays, otherwise it becomes `index + oldCap`. Nodes that moved are marked on the right.']],
    ['When a chain grows: tree', ['A long chain slows the search. When a chain passes 8 Nodes and capacity is below 64, the table resizes first. At capacity 64 or more, the bucket becomes a red-black tree and search becomes `O(log n)`.', 'These 11 keys share one hash: capacity became 32 on the 9th key and 64 on the 10th, and the bucket becomes a tree on the 11th.', 'During a resize, a bucket left with 6 Nodes or fewer goes back to a list. This tool draws the tree as a list and marks the bucket with a `TreeNode` label.']],
    ['Traps to know', ['Order is not guaranteed: elements are visited in bucket order. See the output on the right. If you need insertion order, use `LinkedHashMap`.', 'A `null` key is allowed: its hash is 0 and it lands in bucket 0.', 'It is not thread-safe: for several threads use `ConcurrentHashMap`.', 'Do not change a key: if its `hashCode` changes after it enters the map, the Node stays in the old bucket and the key cannot be found. That is why immutable keys like `String` work well.']],
  ],
};

let route = 'home', hmCh = 0, hmOps = [], hmFlags = HM_FLAGS[0];
const jstr = v => v === null ? 'null' : '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
function hmCode(ops) {
  return ['Map<String, Integer> m = new HashMap<>();'].concat(ops.map(o =>
    o.op === 'put' ? `m.put(${jstr(o.key)}, ${o.val});` : o.op === 'get' ? `m.get(${jstr(o.key)});` : o.op === 'remove' ? `m.remove(${jstr(o.key)});` : 'System.out.println(m);')).join('\n');
}
/* Reads the HashMap out of a real engine snapshot. */
function hmView(ops) {
  const steps = run(hmCode(ops)), st = steps[steps.length - 1];
  const by = {}; st.heap.forEach(o => { by[o.id] = o; });
  const fv = (o, n) => o.fields.find(f => f.name === n).val;
  const mv = st.frames[0].vars.find(v => v.name === 'm');
  const map = mv && mv.val && by[mv.val.r];
  const tr = map ? fv(map, 'table').r : null, tab = tr ? by[tr] : null;
  const keyOf = v => v.r ? by[v.r].value : null;
  const buckets = tab ? tab.elems.map(b => {
    const out = [];
    for (let r = b.r; r; r = fv(by[r], 'next').r) out.push({key:keyOf(fv(by[r], 'key')), val:by[fv(by[r], 'value').r].value, hash:fv(by[r], 'hash').v});
    return out;
  }) : [];
  return {steps, st, cap:tab ? tab.elems.length : 0, size:map ? fv(map, 'size').v : 0, thr:map ? fv(map, 'threshold').v : 0, buckets};
}
function bitRow(label, v, n, mark) {
  const u = v >>> 0, low = n ? Math.log2(n) : 0;
  let cells = '';
  for (let i = 31; i >= 0; i--) {
    const on = (u >>> i) & 1;
    cells += `<i class="${on ? 'b1' : 'b0'}${mark && i < low ? ' mk' : ''}">${on}</i>`;
    if (i && i % 4 === 0) cells += `<span class="${i === 16 ? 'g16' : 'g4'}"></span>`;
  }
  return `<div class="bitrow"><code class="bl">${esc(label)}</code><div class="bits" aria-hidden="true">${cells}</div><b class="bd">${v}</b></div>`;
}
function hmPipeline(v, focus) {
  if (!focus) return `<p class="muted">${esc(s('pipeEmpty'))}</p>`;
  const key = focus.key;
  if (key === null) return `<p class="pipekey"><b>null</b></p><p class="muted">${esc(s('nullKey'))} ${s('bucket')} 0.</p>`;
  const h = JHASH.str(key), hash = h ^ (h >>> 16), n = v.cap, idx = n ? (n - 1) & hash : null;
  const chars = [...Array(key.length).keys()].map(i => `<span class="ch"><b>${esc(key[i])}</b><small>${key.charCodeAt(i)}</small></span>`).join('');
  let html = `<div class="chars" aria-label="${esc(key)}">${chars}</div>`;
  if (hmFlags.calc) {
    let a = 0, rows = '';
    for (let i = 0; i < key.length; i++) {
      const next = (Math.imul(31, a) + key.charCodeAt(i)) | 0;
      rows += `<tr><td>${esc(key[i])}</td><td>31 × ${a} + ${key.charCodeAt(i)}</td><td>${next}</td></tr>`;
      a = next;
    }
    html += `<div class="calc"><h4>${esc(s('calc'))}</h4><table><tbody>${rows}</tbody></table></div>`;
  }
  html += '<div class="bitgrid">' + bitRow('hashCode()', h, n, false) + bitRow('h >>> 16', h >>> 16, n, false) + bitRow('hash', hash, n, !!n);
  if (n) html += bitRow('n - 1', n - 1, n, true) + bitRow('index', idx, n, true);
  html += '</div>';
  if (n) html += `<p class="result"><code>(${n} - 1) &amp; ${hash}</code> = <b>${idx}</b></p>`;
  else html += `<p class="muted">${esc(s('tableNull'))}</p>`;
  return html;
}
function hmWalk(v, focus, idx) {
  const marks = {};
  if (!focus || focus.op !== 'get' || idx === null) return marks;
  const h = JHASH.str(focus.key), hash = h ^ (h >>> 16);
  for (const n of v.buckets[idx] || []) {
    if (n.hash !== hash) marks[n.key] = ['no', s('diffHash')];
    else if (n.key !== focus.key) marks[n.key] = ['no', s('eqFalse')];
    else { marks[n.key] = ['yes', s('eqTrue')]; break; }
  }
  return marks;
}
function hmTable(v, prev, focus) {
  if (!v.cap) return `<p class="muted">${esc(s('tableNull'))}</p>`;
  const idx = focus ? (focus.key === null ? 0 : (v.cap - 1) & (JHASH.str(focus.key) ^ (JHASH.str(focus.key) >>> 16))) : null;
  const marks = hmWalk(v, focus, idx);
  const old = {};
  const resized = prev && prev.cap && prev.cap !== v.cap;
  if (resized) prev.buckets.forEach((b, i) => b.forEach(n => { old[n.key] = i; }));
  let moved = 0;
  const rows = v.buckets.map((b, i) => {
    const chips = b.map((n, j) => {
      const was = old[n.key], shift = resized && was !== undefined && was !== i;
      if (shift) moved++;
      const mark = marks[n.key];
      const k = n.key === null ? 'null' : `"${esc(n.key)}"`;
      return `${j ? '<span class="nx" aria-label="next">next</span>' : ''}<span class="nd${focus && n.key === focus.key ? ' on' : ''}" title="hash ${n.hash}"><b>${k}</b><i class="val">${n.val}</i>${shift ? `<small class="mv">${was} → ${i}</small>` : ''}${mark ? `<small class="ck ${mark[0]}">${esc(mark[1])}</small>` : ''}</span>`;
    }).join('');
    const tree = b.length > 8 && v.cap >= 64 ? `<small class="tn">${esc(s('tree'))}</small>` : '';
    return `<div class="bk${i === idx ? ' hit' : ''}${b.length ? '' : ' empty'}"><code class="bi">${i}</code>${chips || '<span class="nul">null</span>'}${tree}</div>`;
  }).join('');
  const pct = Math.min(100, Math.round(v.size / v.thr * 100));
  return `<div class="gauge"><div class="gtext"><span><code>size</code> <b>${v.size}</b></span><span><code>threshold</code> <b>${v.thr}</b></span><span><code>capacity</code> <b>${v.cap}</b></span>${moved ? `<span class="mvsum">${esc(s('moved')(moved))}</span>` : ''}</div><div class="gbar" role="img" aria-label="size ${v.size} / threshold ${v.thr}"><span style="width:${pct}%"></span></div></div><div class="bks">${rows}</div>`;
}
function hmSpreadDemo() {
  const rows = [65536, 131072].map(k => {
    const hash = k ^ (k >>> 16);
    return `<tr><td><code>${k}</code></td><td>${s('bucket')} ${15 & k}</td><td><b>${s('bucket')} ${15 & hash}</b></td></tr>`;
  }).join('');
  return `<table class="demo"><thead><tr><th>key</th><th>${esc(s('noSpread'))}</th><th>${esc(s('withSpread'))}</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function hmRender() {
  const text = HM_TEXT[LANG][hmCh];
  $('hm-prose').innerHTML = `<h2>${esc(text[0])}</h2>` + text[1].map(p => `<p>${rich(p)}</p>`).join('') + (hmFlags.spread ? hmSpreadDemo() : '');
  $('hm-count').textContent = `${s('section')} ${hmCh + 1} / ${HM_TEXT[LANG].length}`;
  $('hm-prev').disabled = hmCh === 0;
  $('hm-next').disabled = hmCh === HM_TEXT[LANG].length - 1;
  $('hm-ch').value = String(hmCh);
  const v = hmView(hmOps), prev = hmOps.length > 1 ? hmView(hmOps.slice(0, -1)) : null;
  const keyed = hmOps.filter(o => o.op !== 'print');
  const focus = keyed[keyed.length - 1] || null;
  $('hm-pipe').innerHTML = hmPipeline(v, focus);
  $('hm-table').innerHTML = hmTable(v, prev, focus);
  const lastLine = focus ? hmOps.lastIndexOf(focus) + 2 : 0;
  const notes = v.steps.filter(x => x.line === lastLine).flatMap(x => x.notes).filter(n => !/String Pool|Autoboxing|Unboxing/.test(n));
  $('hm-notes').innerHTML = notes.length ? `<h3>${esc(s('notes'))}</h3><ul>${notes.map(n => `<li>${rich(n)}</li>`).join('')}</ul>` : '';
  $('hm-notes').hidden = !notes.length;
  $('hm-codeview').textContent = hmCode(hmOps);
  const o = v.st.out.join('');
  $('hm-out').hidden = !o;
  $('hm-out').textContent = o;
  const e = v.st.error;
  $('hm-err').textContent = e ? e.msg.replace(/`/g, '') : '';
}
function hmChapter(i) {
  hmCh = Math.max(0, Math.min(HM_OPS.length - 1, i));
  hmOps = HM_OPS[hmCh].slice();
  hmFlags = HM_FLAGS[hmCh];
  $('hm-err').textContent = '';
  hmRender();
  $('hm-prose').scrollTop = 0;
}
function hmAct(op) {
  const key = $('hm-key').value, raw = $('hm-val').value.trim(), err = $('hm-err');
  if (hmOps.length >= 60) { err.textContent = s('errMany'); return; }
  if (!key) { err.textContent = s('errKey'); $('hm-key').focus(); return; }
  let val = 0;
  if (op === 'put') {
    val = Number(raw);
    if (!/^-?\d+$/.test(raw) || val > 2147483647 || val < -2147483648) { err.textContent = s('errVal'); $('hm-val').focus(); return; }
  }
  err.textContent = '';
  hmOps = hmOps.filter(o => o.op !== 'print').concat({op, key:key.slice(0, 40), val});
  hmRender();
}
function paintSite() {
  document.querySelectorAll('[data-s]').forEach(el => { el.textContent = nb(s(el.dataset.s)); });
  document.querySelectorAll('.crumb').forEach(el => el.setAttribute('aria-label', s('topics')));
  const sel = $('hm-ch'); sel.textContent = '';
  HM_TEXT[LANG].forEach((c, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${i + 1}. ${c[0]}`; sel.appendChild(o); });
  $('hm-t-prev').textContent = t('prev');
  $('hm-t-next').textContent = t('next');
  document.querySelectorAll('[data-ls-title]').forEach(el => { el.textContent = nb(LS[el.dataset.lsTitle].text[LANG].title); });
  document.querySelectorAll('[data-ls-door]').forEach(el => { el.textContent = nb(LS[el.dataset.lsDoor].text[LANG].door); });
  document.title = pageTitle(route);
  if (route === 'hashmap') hmRender();
  if (LS_ORDER.includes(route)) { if (lsId !== route) lsOpen(route); else lsRefresh(); }
}
function show(r) {
  route = r;
  const isLs = LS_ORDER.includes(r);
  for (const name of ['home', 'jvm', 'hashmap']) $('view-' + name).hidden = name !== r;
  $('view-lesson').hidden = !isLs;
  document.title = pageTitle(r);
  if (r === 'jvm') { stopPlay(); render(false); showActiveLine(); redraw(); }
  if (r === 'hashmap') hmRender();
  if (isLs) lsOpen(r);
  window.scrollTo(0, 0);
}
/* Every topic has a real page per language, such as az/gc/, so search engines can find it.
   On the web the address follows the view; opened from disk, the site keeps using #gc-az. Old #gc links still work. */
const PAGE = document.documentElement.dataset;
const SITE_ROOT = new URL(PAGE.root || './', location.href);
const ON_WEB = /^https?:$/.test(location.protocol);
const ROUTES = () => ['home', 'jvm', 'hashmap', ...LS_ORDER];
const pageHref = (r, lang) => new URL(lang + '/' + (r === 'home' ? '' : r + '/'), SITE_ROOT).href;
function pageTitle(r) {
  const name = r === 'jvm' ? t('title') : r === 'hashmap' ? s('hmTitle') : LS_ORDER.includes(r) ? LS[r].text[LANG].title : '';
  return (name ? name + ' · ' : '') + s('site');
}
function pathRoute() {
  if (!ON_WEB) return null;
  const rel = decodeURIComponent(location.pathname).slice(SITE_ROOT.pathname.length);
  const m = /^([a-z]{2})\/(?:([a-z]+)\/)?(?:index\.html)?$/.exec(rel);
  if (!m || !UI[m[1]]) return null;
  const r = m[2] || 'home';
  return ROUTES().includes(r) ? {route:r, lang:m[1]} : null;
}
function where() {
  if (location.hash.length > 1) return parseHash();
  return pathRoute() || {route:PAGE.route || 'home', lang:PAGE.lang || null};
}
function setAddress(push) {
  try {
    const url = ON_WEB ? pageHref(route, LANG) : '#' + route + '-' + LANG;
    if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);
  } catch (e) { /* the sandbox may refuse; the view still changes */ }
}
function go(r) {
  show(r);
  setAddress(true);
}
function parseHash() {
  const m = /^#?([a-z]+)(?:-([a-z]{2}))?$/.exec(location.hash);
  if (!m) return {route:'home', lang:null};
  if (UI[m[1]]) return {route:'jvm', lang:m[1]};
  return {route:['home', 'jvm', 'hashmap', ...LS_ORDER].includes(m[1]) ? m[1] : 'home', lang:UI[m[2]] ? m[2] : null};
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (!b || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
  e.preventDefault();
  go(b.dataset.go);
});
function follow() {
  const p = where();
  if (p.lang && p.lang !== LANG) setLang(p.lang, true);
  if (p.route !== route) show(p.route);
}
window.addEventListener('hashchange', follow);
window.addEventListener('popstate', follow);
$('hm-prev').onclick = () => hmChapter(hmCh - 1);
$('hm-next').onclick = () => hmChapter(hmCh + 1);
$('hm-ch').addEventListener('change', e => hmChapter(+e.target.value));
$('hm-form').addEventListener('submit', e => { e.preventDefault(); hmAct('put'); });
$('hm-get').onclick = () => hmAct('get');
$('hm-remove').onclick = () => hmAct('remove');
$('hm-clear').onclick = () => { hmOps = []; $('hm-err').textContent = ''; hmRender(); };
$('hm-open').onclick = () => {
  $('code').value = hmCode(hmOps);
  $('samples').value = 'own';
  saveDraft(); compile(); go('jvm');
};
