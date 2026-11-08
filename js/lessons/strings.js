/* ---------- String: real field layout ---------- */
function sInfo(s) {
  const latin = [...Array(s.length).keys()].every(i => s.charCodeAt(i) < 256);
  const bytes = [];
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (latin) bytes.push(c); else bytes.push(c & 255, c >> 8); }
  return {coder:latin ? 0 : 1, bytes, len:s.length, cp:[...s].length, hash:JHASH.str(s)};
}
const hex2 = b => b.toString(16).toUpperCase().padStart(2, '0');
function sBytes(info) {
  if (!info.bytes.length) return '<p class="muted">byte[0]</p>';
  const groups = [];
  const size = info.coder ? 2 : 1;
  for (let i = 0; i < info.bytes.length; i += size) groups.push(info.bytes.slice(i, i + size));
  return `<div class="bytes">${groups.map(g => `<span class="bgroup">${g.map(b => `<i>${hex2(b)}</i>`).join('')}</span>`).join('')}</div>`;
}
function sChars(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i), wide = c > 255, sur = c >= 0xD800 && c <= 0xDFFF;
    out += `<span class="ch${wide ? ' wide' : ''}"><b>${sur ? '?' : esc(s[i])}</b><small>${c}</small></span>`;
  }
  return `<div class="chars">${out}</div>`;
}
const S_WORDS = {0:'salam', 1:'çörək', 2:'a😀', 3:'salam', 4:'salam'};
function sForm(st, presets) {
  return `<form class="tryit" data-submit="word" autocomplete="off"><h3>${esc(SITE[LANG].tryIt)}</h3><div class="stf-row"><input id="s-word" name="word" type="text" maxlength="24" spellcheck="false" autocapitalize="off" aria-label="String" value="${esc(st.s)}"><button class="btn primary" type="submit">OK</button></div><div class="opchips">${presets.map(p => `<button class="opchip" type="button" data-act="preset" data-v="${esc(p)}"><code class="bare">"${esc(p)}"</code></button>`).join('')}</div></form>`;
}
LS.strings = {
  init(i) { return {s:S_WORDS[i] || 'salam'}; },
  controls(st, ch) {
    if (ch === 0) return sForm(st, ['salam', '', 'Java']);
    if (ch === 1) return sForm(st, ['çörək', 'çörek', 'şəkər', 'salam']);
    if (ch === 2) return sForm(st, ['a😀', '😀', 'Əli']);
    return '';
  },
  stage(st, ch) {
    const info = sInfo(st.s);
    if (ch === 0) {
      return pnl(lu('objT'), `<pre class="logv">public final class String {
    private final byte[] value;
    private final byte coder;
    private int hash;
    private boolean hashIsZero;
}</pre><table class="demo"><tbody><tr><td><code>value</code></td><td>${sBytes(info)}</td></tr><tr><td><code>coder</code></td><td><b>${info.coder}</b> (${info.coder ? 'UTF16' : 'LATIN1'})</td></tr><tr><td><code>length()</code></td><td><b>${info.len}</b></td></tr><tr><td><code>hashCode()</code></td><td><b>${info.hash}</b></td></tr><tr><td><code>hashIsZero</code></td><td><b>${info.hash === 0}</b></td></tr></tbody></table>`) + pnl('', measured(rich(lu('m0'))));
    }
    if (ch === 1) {
      return pnl(`"${st.s}"`, `${sChars(st.s)}<div class="gtext"><span><code>coder</code> <b>${info.coder ? 'UTF16' : 'LATIN1'}</b></span><span><code>length()</code> <b>${info.len}</b></span><span><code>value.length</code> <b>${info.bytes.length} byte</b></span></div>${sBytes(info)}<p class="explain-s">${rich(info.coder ? ls$('wide', [...st.s].find(c => c.codePointAt(0) > 255)) : lu('narrow'))}</p>`)
        + pnl(lu('pairs'), `<table class="demo"><thead><tr><th>String</th><th>coder</th><th>byte</th></tr></thead><tbody>${['çörek', 'çörək', 'şəkər', 'Əli', 'é', 'ğ', 'ı'].map(w => { const x = sInfo(w); return `<tr><td><code>"${w}"</code></td><td>${x.coder ? 'UTF16' : '<b>LATIN1</b>'}</td><td>${x.bytes.length}</td></tr>`; }).join('')}</tbody></table>` + measured(rich(lu('m1'))));
    }
    if (ch === 2) {
      const cps = [...st.s].map(c => `<span class="ch"><b>${esc(c)}</b><small>U+${c.codePointAt(0).toString(16).toUpperCase()}</small></span>`).join('');
      return pnl(`"${st.s}"`, `<h3 class="subh"><code class="bare">char</code>: <b>length() = ${info.len}</b></h3>${sChars(st.s)}<h3 class="subh">Code point: <b>codePointCount() = ${info.cp}</b></h3><div class="chars">${cps}</div><p class="explain-s">${rich(info.len !== info.cp ? lu('surr') : lu('noSurr'))}</p>`) + pnl('', measured(rich(lu('m2'))));
    }
    if (ch === 3) {
      const row = (name, obj, val, note) => `<div class="sobj"><code class="bare">${esc(name)}</code><span class="sbox">${esc(obj)}</span><span class="sarrow" aria-hidden="true">→</span><span class="sarr ${val}">byte[] ${val === 'a' ? '#A' : val === 'b' ? '#B' : '#C'}</span><span class="muted small">${esc(note)}</span></div>`;
      return pnl(lu('shareT'), `<div class="sobjs">${row('String a = "salam";', 'String #1', 'a', lu('n1'))}${row('String b = new String(a);', 'String #2', 'a', lu('n2'))}${row('String c = a.substring(1, 3);', 'String #3', 'b', lu('n3'))}${row('String d = "əli salam".substring(4);', 'String #4', 'c', lu('n4'))}</div>`)
        + pnl('', measured(rich(lu('m3'))));
    }
    return pnl(lu('concatT'), `<pre class="logv">String s = "";
for (int i = 0; i &lt; 100_000; i++) s += "x";      // ${esc(lu('c1'))}

StringBuilder b = new StringBuilder();
for (int i = 0; i &lt; 100_000; i++) b.append("x"); // ${esc(lu('c2'))}</pre><div class="barrow"><span><code class="bare">+=</code></span><div class="hbar"><i style="width:100%"></i></div><b>271 ms</b></div><div class="barrow"><span><code class="bare">append</code></span><div class="hbar"><i style="width:1%"></i></div><b>1 ms</b></div>` + measured(rich(lu('m4'))));
  },
  act(st, a, v) {
    if (a === 'word') st.s = String(v.get('word'));
    if (a === 'preset') st.s = v;
  },
  text: {
    az: {title:'String daxildən', door:'String-in daxili quruluşu: byte[], LATIN1 və UTF16, emoji-nin uzunluğu, paylaşılan array və += qiyməti.',
      ui:{objT:'String object-i', m0:'JDK 21-də field-lər reflection ilə oxunub. Boş String-də `hash` 0-dır və `hashIsZero` `true` olur.', wide:c => `\`${c}\` 255-dən böyükdür, LATIN1-ə sığmır. Ona görə bütün String hər character üçün 2 byte tutur.`, narrow:'Bütün character-lər 255-dən kiçikdir: LATIN1, hər biri 1 byte.', pairs:'Azərbaycan və türk hərfləri', m1:'Cədvəl JDK 21-də `value` və `coder` field-lərindən oxunub. Byte sırası bu Mac-də little-endian-dır.', surr:'`😀` iki `char`-dır, yəni surrogate pair. `length()` `char` sayır, istifadəçinin gördüyü simvolu yox. `substring` onu ortadan kəsə bilər.', noSurr:'Burada surrogate pair yoxdur: hər `char` bir code point-dir.', m2:'`"😀".length()` 2, `codePointCount` 1, `charAt(0)` 55357, `charAt(1)` 56832 verdi.', shareT:'value array-i kimin?', n1:'literal, String Pool-da', n2:'yeni object, array eynidir', n3:'yeni array: "al"', n4:'UTF16-dan LATIN1-ə sıxıldı: 5 byte', m3:'`value` field-ləri `==` ilə müqayisə olundu: `new String` eyni array-i işlədir, `substring` yenisini yaradır. `"əli salam".substring(4)` isə `coder = 0` verdi.', concatT:'Dövrədə += və StringBuilder', c1:'hər dəfə yeni String', c2:'eyni buffer', m4:'100 000 təkrarla bir ölçü, JDK 21. Dəqiq ms maşından asılıdır.'},
      ch:[
        ['String-in içində nə var?', ['Java 9-dan bəri `String` içində `char[]` yox, `byte[]` saxlayır. `coder` byte-ların necə oxunacağını deyir.', '`final` array immutable olmasını özü təmin etmir: `value` private-dır və heç bir method onu dəyişmir. Hər “dəyişiklik” yeni String yaradır.', '`hash` ilk `hashCode()`-da hesablanır və saxlanır, ona görə String yaxşı HashMap key-idir.']],
        ['LATIN1 yoxsa UTF16?', ['Bütün character-lər 255-dən kiçikdirsə, hər biri 1 byte tutur: Compact Strings. Bir dənə böyük character bütün String-i 2 byte-a keçirir.', 'Azərbaycan dilində bu çox görünür: `ç`, `ö`, `ü` LATIN1-dədir, `ə`, `ş`, `ğ`, `ı` isə yox.', '`"çörek"` 5 byte, `"çörək"` isə 10 byte tutur. Fərq bir hərfdir.']],
        ['length() simvol saymır', ['`length()` `char` sayır, `char` isə 16 bit-dir. Emoji-lər 16 bit-ə sığmır və iki `char` tutur: surrogate pair.', 'İstifadəçinin gördüyü simvolları saymaq üçün `codePointCount` işlət. Bayraq və ailə emoji-ləri kimi birləşmələr isə bir neçə code point-dən ibarətdir.']],
        ['Array nə vaxt paylaşılır?', ['`new String(a)` yeni object yaradır, amma `value` array-ini kopyalamır: immutable olduğu üçün paylaşmaq təhlükəsizdir.', '`substring` isə həmişə yeni array yaradır. Bu, Java 7u6-dan belədir: kiçik substring böyük array-i memory-də saxlamasın deyə.', 'Maraqlı hal: UTF16 String-in LATIN1 hissəsini kəssən, nəticə sıxılır.']],
        ['Dövrədə += niyə yavaşdır?', ['String immutable olduğu üçün hər `+=` bütün mətni yeni array-ə kopyalayır. Uzunluq artdıqca kopya da böyüyür: `O(n²)`.', '`StringBuilder` bir buffer saxlayır və yalnız dolanda böyüyür. Dövrədə həmişə onu işlət.', 'Dövrədən kənar `a + b + c` isə problem deyil: `javac` onu bir `invokedynamic` çağırışına çevirir.']],
      ]},
    tr: {title:'String içeriden', door:"String'in iç yapısı: byte[], LATIN1 ve UTF16, emoji uzunluğu, paylaşılan array ve += bedeli.",
      ui:{objT:"String object'i", m0:"JDK 21'de field'lar reflection ile okundu. Boş String'de `hash` 0'dır ve `hashIsZero` `true` olur.", wide:c => `\`${c}\` 255'ten büyük, LATIN1'e sığmaz. Bu yüzden tüm String her character için 2 byte tutar.`, narrow:"Tüm character'ler 255'ten küçük: LATIN1, her biri 1 byte.", pairs:'Azerbaycan ve Türk harfleri', m1:"Tablo JDK 21'de `value` ve `coder` field'larından okundu. Byte sırası bu Mac'te little-endian.", surr:"`😀` iki `char`'dır, yani surrogate pair. `length()` `char` sayar, kullanıcının gördüğü simgeyi değil. `substring` onu ortadan kesebilir.", noSurr:'Burada surrogate pair yok: her `char` bir code point.', m2:'`"😀".length()` 2, `codePointCount` 1, `charAt(0)` 55357, `charAt(1)` 56832 verdi.', shareT:"value array'i kimin?", n1:"literal, String Pool'da", n2:'yeni object, array aynı', n3:'yeni array: "al"', n4:"UTF16'dan LATIN1'e sıkıştı: 5 byte", m3:"`value` field'ları `==` ile karşılaştırıldı: `new String` aynı array'i kullanır, `substring` yenisini oluşturur. `\"əli salam\".substring(4)` ise `coder = 0` verdi.", concatT:'Döngüde += ve StringBuilder', c1:'her seferinde yeni String', c2:'aynı buffer', m4:"100 000 tekrarla bir ölçüm, JDK 21. Kesin ms makineye bağlıdır."},
      ch:[
        ["String'in içinde ne var?", ["Java 9'dan beri `String` içinde `char[]` değil, `byte[]` tutar. `coder`, byte'ların nasıl okunacağını söyler.", "`final` array immutable olmayı tek başına sağlamaz: `value` private'tır ve hiçbir method onu değiştirmez. Her “değişiklik” yeni String oluşturur.", "`hash` ilk `hashCode()` çağrısında hesaplanır ve saklanır, bu yüzden String iyi bir HashMap key'idir."]],
        ['LATIN1 mi UTF16 mı?', ["Tüm character'ler 255'ten küçükse her biri 1 byte tutar: Compact Strings. Tek bir büyük character tüm String'i 2 byte'a geçirir.", "Azerbaycan ve Türk harflerinde bu sık görülür: `ç`, `ö`, `ü` LATIN1'dedir, `ə`, `ş`, `ğ`, `ı` ise değildir.", '`"çörek"` 5 byte, `"çörək"` ise 10 byte tutar. Fark tek harftir.']],
        ['length() simge saymaz', ["`length()` `char` sayar, `char` ise 16 bit'tir. Emoji'ler 16 bit'e sığmaz ve iki `char` tutar: surrogate pair.", "Kullanıcının gördüğü simgeleri saymak için `codePointCount` kullan. Bayrak ve aile emoji'leri gibi birleşimler ise birkaç code point'ten oluşur."]],
        ['Array ne zaman paylaşılır?', ["`new String(a)` yeni object oluşturur, ama `value` array'ini kopyalamaz: immutable olduğu için paylaşmak güvenlidir.", "`substring` ise her zaman yeni array oluşturur. Java 7u6'dan beri böyledir: küçük substring büyük array'i memory'de tutmasın diye.", "İlginç durum: UTF16 String'in LATIN1 kısmını kesersen sonuç sıkıştırılır."]],
        ['Döngüde += neden yavaş?', ["String immutable olduğu için her `+=` tüm metni yeni array'e kopyalar. Uzunluk arttıkça kopya da büyür: `O(n²)`.", "`StringBuilder` bir buffer tutar ve yalnızca dolunca büyür. Döngüde her zaman onu kullan.", "Döngü dışında `a + b + c` sorun değildir: `javac` onu tek bir `invokedynamic` çağrısına çevirir."]],
      ]},
    en: {title:'String inside', door:'What is inside a String: byte[], LATIN1 and UTF16, emoji length, shared arrays and the cost of +=.',
      ui:{objT:'A String object', m0:'Fields were read with reflection on JDK 21. For an empty String, `hash` is 0 and `hashIsZero` becomes `true`.', wide:c => `\`${c}\` is above 255 and does not fit in LATIN1. So the whole String takes 2 bytes per character.`, narrow:'All characters are below 256: LATIN1, 1 byte each.', pairs:'Azerbaijani and Turkish letters', m1:'The table was read from the `value` and `coder` fields on JDK 21. The byte order on this Mac is little-endian.', surr:'`😀` is two `char`s, a surrogate pair. `length()` counts `char`s, not the symbols you see. `substring` can cut it in half.', noSurr:'There is no surrogate pair here: each `char` is one code point.', m2:'`"😀".length()` gave 2, `codePointCount` 1, `charAt(0)` 55357 and `charAt(1)` 56832.', shareT:'Who owns the value array?', n1:'literal, in the String Pool', n2:'new object, same array', n3:'new array: "al"', n4:'compressed from UTF16 to LATIN1: 5 bytes', m3:'The `value` fields were compared with `==`: `new String` uses the same array and `substring` makes a new one. `"əli salam".substring(4)` gave `coder = 0`.', concatT:'+= and StringBuilder in a loop', c1:'a new String every time', c2:'the same buffer', m4:'One measurement with 100,000 rounds on JDK 21. Exact ms depend on the machine.'},
      ch:[
        ['What is inside a String?', ['Since Java 9, `String` holds a `byte[]`, not a `char[]`. `coder` says how to read the bytes.', 'A `final` array alone does not make it immutable: `value` is private and no method changes it. Every "change" creates a new String.', '`hash` is computed on the first `hashCode()` and then kept, which makes String a good HashMap key.']],
        ['LATIN1 or UTF16?', ['If every character is below 256, each takes 1 byte: Compact Strings. One larger character moves the whole String to 2 bytes each.', 'Azerbaijani shows this often: `ç`, `ö`, `ü` are in LATIN1, but `ə`, `ş`, `ğ`, `ı` are not.', '`"çörek"` takes 5 bytes and `"çörək"` takes 10. The difference is one letter.']],
        ['length() does not count symbols', ['`length()` counts `char`s, and a `char` is 16 bits. Emojis do not fit in 16 bits and take two `char`s: a surrogate pair.', 'To count the symbols a person sees, use `codePointCount`. Combined forms, such as flags and family emojis, are made of several code points.']],
        ['When is the array shared?', ['`new String(a)` creates a new object but does not copy the `value` array: since it is immutable, sharing is safe.', '`substring` always creates a new array. It has worked this way since Java 7u6, so a small substring does not keep a big array in memory.', 'An interesting case: cut a LATIN1 part from a UTF16 String and the result gets compressed.']],
        ['Why is += slow in a loop?', ['A String is immutable, so every `+=` copies all the text into a new array. As the text grows, so does the copy: `O(n²)`.', '`StringBuilder` keeps one buffer and grows it only when full. Always use it in a loop.', 'Outside a loop, `a + b + c` is fine: `javac` turns it into one `invokedynamic` call.']],
      ]},
  },
};
