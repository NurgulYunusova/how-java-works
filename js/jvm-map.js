const UI = {
  az: {
    title:'JVM: Stack və Heap', lede:'Java kodu yaz və hər variable-ın yaddaşda hara düşdüyünü sətir-sətir izlə.',
    langs:'Dil', pick:'Hazır nümunə seç', own:'Öz kodum', code:'Java kodu', desk:'Kod', map:'Yaddaş xəritəsi', out:'Proqramın çıxışı', scrub:'Addım seçimi',
    prev:'Əvvəlki', next:'Növbəti', play:'Oynat', stop:'Dayandır', step:(a, b) => `Addım ${a} / ${b}`,
    stackHint:'Method bitəndə silinir', keyValue:'value-nun özü', keyRef:'reference: value xəttin getdiyi yerdədir',
    model:'Bu, Java dilinin yaddaş modelidir. JIT compiler-i işləyərkən bəzi object-ləri optimallaşdırıb heap-ə heç qoymaya bilər.',
    poolText:'Heap-in içindədir. Eyni mətnli literal-lar bir object-i paylaşır.', cache:'Wrapper cache', cacheText:'Heap-in içindədir. Kiçik value-lar üçün hazır object-lər. Integer üçün: −128 ... 127.',
    emptyHeap:'Heap hələ boşdur. Burada object-lər görünəcək: String, Integer, array-lər, collection-lar və öz class-ların. Primitive local variable-lar stack-də qalır.',
    emptyFrame:'Bu frame-də hələ variable yoxdur.', emptyStack:'Stack boşdur.', noValue:'value yoxdur', gone:'Reference yoxdur: GC silə bilər',
    shared:'shared boş array', length:n => `length ${n}`, statics:'static field-lər',
    start:'Proqram başlayır', startText:'JVM <code>main</code> method-u üçün stack-də ilk frame-i yaradır.', noChange:'Yaddaşda dəyişiklik olmadı.',
    happened:n => `${ordinal(n)} sətirdə nə baş verdi`, compileErr:n => `${ordinal(n)} sətir compile olunmur`, runtimeErr:n => `${ordinal(n)} sətirdə runtime xətası`,
    unreadable:'Bu kod oxuna bilmədi. Son dəyişikliyi yoxla.',
    groups:{basics:'Əsaslar', text:'String', oop:'Object-lər və inheritance', list:'ArrayList və LinkedList', map:'HashMap və HashSet', stack:'Method-lar, Stack və GC'},
  },
  tr: {
    title:'JVM: Stack ve Heap', lede:'Java kodu yaz ve her variable\'ın bellekte nereye düştüğünü satır satır izle.',
    langs:'Dil', pick:'Hazır örnek seç', own:'Kendi kodum', code:'Java kodu', desk:'Kod', map:'Bellek haritası', out:'Programın çıktısı', scrub:'Adım seçimi',
    prev:'Önceki', next:'Sonraki', play:'Oynat', stop:'Durdur', step:(a, b) => `Adım ${a} / ${b}`,
    stackHint:'Method bitince silinir', keyValue:'value\'nun kendisi', keyRef:'reference: value çizginin gittiği yerde',
    model:'Bu, Java dilinin bellek modelidir. JIT compiler\'ı çalışırken bazı object\'leri optimize edip heap\'e hiç koymayabilir.',
    poolText:'Heap\'in içindedir. Aynı metinli literal\'ler tek bir object\'i paylaşır.', cache:'Wrapper cache', cacheText:'Heap\'in içindedir. Küçük value\'lar için hazır object\'ler. Integer için: −128 ... 127.',
    emptyHeap:'Heap henüz boş. Burada object\'ler görünecek: String, Integer, array\'ler, collection\'lar ve kendi class\'ların. Primitive local variable\'lar stack\'te kalır.',
    emptyFrame:'Bu frame\'de henüz variable yok.', emptyStack:'Stack boş.', noValue:'value yok', gone:'Reference yok: GC silebilir',
    shared:'shared boş array', length:n => `length ${n}`, statics:'static field\'lar',
    start:'Program başlıyor', startText:'JVM, <code>main</code> method\'u için stack\'te ilk frame\'i oluşturur.', noChange:'Bellekte değişiklik olmadı.',
    happened:n => `${n}. satırda ne oldu`, compileErr:n => `${n}. satır compile olmuyor`, runtimeErr:n => `${n}. satırda runtime hatası`,
    unreadable:'Bu kod okunamadı. Son değişikliği kontrol et.',
    groups:{basics:'Temeller', text:'String', oop:'Object\'ler ve inheritance', list:'ArrayList ve LinkedList', map:'HashMap ve HashSet', stack:'Method\'lar, Stack ve GC'},
  },
  en: {
    title:'JVM: Stack and Heap', lede:'Write Java code and follow, line by line, where each variable lands in memory.',
    langs:'Language', pick:'Choose an example', own:'My code', code:'Java code', desk:'Code', map:'Memory map', out:'Program output', scrub:'Choose a step',
    prev:'Previous', next:'Next', play:'Play', stop:'Pause', step:(a, b) => `Step ${a} / ${b}`,
    stackHint:'Cleared when a method ends', keyValue:'the value itself', keyRef:'reference: the value is where the line goes',
    model:'This is the memory model of the Java language. While running, the JIT compiler may optimize some objects so they never reach the heap.',
    poolText:'Lives inside the heap. String literals with the same text share one object.', cache:'Wrapper cache', cacheText:'Lives inside the heap. Ready-made objects for small values. For Integer: −128 ... 127.',
    emptyHeap:'The heap is empty so far. Objects will appear here: String, Integer, arrays, collections and your own classes. Primitive local variables stay on the stack.',
    emptyFrame:'This frame has no variables yet.', emptyStack:'The stack is empty.', noValue:'no value', gone:'No references: GC can remove it',
    shared:'shared empty array', length:n => `length ${n}`, statics:'static fields',
    start:'The program starts', startText:'The JVM creates the first stack frame for the <code>main</code> method.', noChange:'Nothing changed in memory.',
    happened:n => `What happened on line ${n}`, compileErr:n => `Line ${n} does not compile`, runtimeErr:n => `Runtime error on line ${n}`,
    unreadable:'This code could not be read. Check your last change.',
    groups:{basics:'Basics', text:'String', oop:'Objects and inheritance', list:'ArrayList and LinkedList', map:'HashMap and HashSet', stack:'Methods, stack and GC'},
  },
};
/* Keeps a suffix on the same line as its word: heap-ə never breaks after the hyphen. */
const nb = s => String(s).replace(/(\p{L})-(?=\p{L})/gu, '$1-\u2060');
const t = k => { const v = UI[LANG][k]; return typeof v === 'string' ? nb(v) : v; };
const SAMPLES = [
  {group:'basics',
   name:{az:'Sənin nümunən: String, int, Integer', tr:'İlk örnek: String, int, Integer', en:'First example: String, int, Integer'},
   code:{az:`String s = "salam";\nint a = 4;\nInteger b = 4;`, tr:`String s = "merhaba";\nint a = 4;\nInteger b = 4;`, en:`String s = "hello";\nint a = 4;\nInteger b = 4;`}},
  {group:'basics',
   name:{az:'String: eyni, yoxsa ayrı?', tr:'String: aynı mı, ayrı mı?', en:'String: same or separate?'},
   code:{az:`String a = "salam";\nString b = "salam";\nString c = new String("salam");\n\nboolean d = a == b;\nboolean e = a == c;\nboolean f = a.equals(c);\n\nString g = c.intern();\nboolean h = a == g;`,
         tr:`String a = "merhaba";\nString b = "merhaba";\nString c = new String("merhaba");\n\nboolean d = a == b;\nboolean e = a == c;\nboolean f = a.equals(c);\n\nString g = c.intern();\nboolean h = a == g;`,
         en:`String a = "hello";\nString b = "hello";\nString c = new String("hello");\n\nboolean d = a == b;\nboolean e = a == c;\nboolean f = a.equals(c);\n\nString g = c.intern();\nboolean h = a == g;`}},
  {group:'basics',
   name:{az:'Integer: 127 və 128', tr:'Integer: 127 ve 128', en:'Integer: 127 and 128'},
   code:{az:`Integer a = 127;\nInteger b = 127;\nInteger c = 128;\nInteger d = 128;\n\nboolean kicik = a == b;\nboolean boyuk = c == d;\nboolean duzgun = c.equals(d);`,
         tr:`Integer a = 127;\nInteger b = 127;\nInteger c = 128;\nInteger d = 128;\n\nboolean kucuk = a == b;\nboolean buyuk = c == d;\nboolean dogru = c.equals(d);`,
         en:`Integer a = 127;\nInteger b = 127;\nInteger c = 128;\nInteger d = 128;\n\nboolean small = a == b;\nboolean big = c == d;\nboolean correct = c.equals(d);`}},
  {group:'basics',
   name:{az:'Object və array', tr:'Object ve array', en:'Object and array'},
   code:{az:`class Telebe {\n  String ad;\n  int yas;\n}\n\nTelebe t = new Telebe();\nt.ad = "Aysel";\nt.yas = 20;\n\nTelebe t2 = t;\nt2.yas = 21;\n\nint[] ballar = {90, 75};\nString[] adlar = {"Aysel", "Murad"};`,
         tr:`class Ogrenci {\n  String ad;\n  int yas;\n}\n\nOgrenci o = new Ogrenci();\no.ad = "Ayşe";\no.yas = 20;\n\nOgrenci o2 = o;\no2.yas = 21;\n\nint[] notlar = {90, 75};\nString[] adlar = {"Ayşe", "Mert"};`,
         en:`class Student {\n  String name;\n  int age;\n}\n\nStudent s = new Student();\ns.name = "Alice";\ns.age = 20;\n\nStudent s2 = s;\ns2.age = 21;\n\nint[] scores = {90, 75};\nString[] names = {"Alice", "Bob"};`}},
  {group:'list',
   name:{az:'ArrayList: daxildə array', tr:'ArrayList: içinde array', en:'ArrayList: an array inside'},
   code:{az:`List<Integer> ededler = new ArrayList<>();\nededler.add(4);\nededler.add(200);\n\nint ilk = ededler.get(0);\nededler.remove(0);`,
         tr:`List<Integer> sayilar = new ArrayList<>();\nsayilar.add(4);\nsayilar.add(200);\n\nint ilk = sayilar.get(0);\nsayilar.remove(0);`,
         en:`List<Integer> numbers = new ArrayList<>();\nnumbers.add(4);\nnumbers.add(200);\n\nint first = numbers.get(0);\nnumbers.remove(0);`}},
  {group:'list',
   name:{az:'ArrayList: array dolanda', tr:'ArrayList: array dolunca', en:'ArrayList: when the array fills up'},
   code:{az:`ArrayList<String> adlar = new ArrayList<>(2);\nadlar.add("Aysel");\nadlar.add("Murad");\nadlar.add("Leyla");\n\nSystem.out.println(adlar);`,
         tr:`ArrayList<String> adlar = new ArrayList<>(2);\nadlar.add("Ayşe");\nadlar.add("Mert");\nadlar.add("Elif");\n\nSystem.out.println(adlar);`,
         en:`ArrayList<String> names = new ArrayList<>(2);\nnames.add("Alice");\nnames.add("Bob");\nnames.add("Carol");\n\nSystem.out.println(names);`}},
  {group:'map',
   name:{az:'HashMap: key, bucket, Node', tr:'HashMap: key, bucket, Node', en:'HashMap: key, bucket, Node'},
   code:{az:`Map<String, Integer> yaslar = new HashMap<>();\nyaslar.put("Aysel", 20);\nyaslar.put("Leyla", 200);\nyaslar.put("Aysel", 21);\n\nint yas = yaslar.get("Aysel");`,
         tr:`Map<String, Integer> yaslar = new HashMap<>();\nyaslar.put("Ayşe", 20);\nyaslar.put("Mert", 200);\nyaslar.put("Ayşe", 21);\n\nint yas = yaslar.get("Ayşe");`,
         en:`Map<String, Integer> ages = new HashMap<>();\nages.put("Alice", 20);\nages.put("Bob", 200);\nages.put("Alice", 21);\n\nint age = ages.get("Alice");`}},
  {group:'map',
   name:{az:'HashMap: collision', tr:'HashMap: collision', en:'HashMap: collision'},
   code:{az:`// "Aa" və "BB" eyni hashCode-a malikdir\nHashMap<String, Integer> m = new HashMap<>();\nm.put("Aa", 1);\nm.put("BB", 2);\n\nboolean eyni = "Aa".hashCode() == "BB".hashCode();\nint b = m.get("BB");`,
         tr:`// "Aa" ve "BB" aynı hashCode'a sahiptir\nHashMap<String, Integer> m = new HashMap<>();\nm.put("Aa", 1);\nm.put("BB", 2);\n\nboolean ayni = "Aa".hashCode() == "BB".hashCode();\nint b = m.get("BB");`,
         en:`// "Aa" and "BB" have the same hashCode\nHashMap<String, Integer> m = new HashMap<>();\nm.put("Aa", 1);\nm.put("BB", 2);\n\nboolean same = "Aa".hashCode() == "BB".hashCode();\nint b = m.get("BB");`}},
  {group:'map',
   name:{az:'HashMap: table böyüyür', tr:'HashMap: table büyüyor', en:'HashMap: the table grows'},
   code:{az:`HashMap<String, Integer> m = new HashMap<>(2);\nm.put("a", 1);\nm.put("b", 2);\nm.put("c", 3);\n\nfor (String acar : m.keySet()) {\n  System.out.println(acar);\n}`,
         tr:`HashMap<String, Integer> m = new HashMap<>(2);\nm.put("a", 1);\nm.put("b", 2);\nm.put("c", 3);\n\nfor (String anahtar : m.keySet()) {\n  System.out.println(anahtar);\n}`,
         en:`HashMap<String, Integer> m = new HashMap<>(2);\nm.put("a", 1);\nm.put("b", 2);\nm.put("c", 3);\n\nfor (String key : m.keySet()) {\n  System.out.println(key);\n}`}},
  {group:'stack',
   name:{az:'Method call', tr:'Method call', en:'Method call'},
   code:{az:`static int kvadrat(int x) {\n  int netice = x * x;\n  return netice;\n}\n\nstatic int cem(int a, int b) {\n  int c = kvadrat(a);\n  return c + b;\n}\n\nint x = 3;\nint y = cem(x, 4);`,
         tr:`static int kare(int x) {\n  int sonuc = x * x;\n  return sonuc;\n}\n\nstatic int topla(int a, int b) {\n  int c = kare(a);\n  return c + b;\n}\n\nint x = 3;\nint y = topla(x, 4);`,
         en:`static int square(int x) {\n  int result = x * x;\n  return result;\n}\n\nstatic int add(int a, int b) {\n  int c = square(a);\n  return c + b;\n}\n\nint x = 3;\nint y = add(x, 4);`}},
  {group:'stack',
   name:{az:'Garbage Collection', tr:'Garbage Collection', en:'Garbage collection'},
   code:{az:`String s = new String("köhnə");\ns = "yeni";\n\nInteger b = 1000;\nb = 2000;\n\nint[] m = {1, 2, 3};\nm = null;`,
         tr:`String s = new String("eski");\ns = "yeni";\n\nInteger b = 1000;\nb = 2000;\n\nint[] d = {1, 2, 3};\nd = null;`,
         en:`String s = new String("old");\ns = "new";\n\nInteger b = 1000;\nb = 2000;\n\nint[] a = {1, 2, 3};\na = null;`}},
  {group:'stack',
   name:{az:'Stack dolur', tr:'Stack doluyor', en:'The stack fills up'},
   code:{az:`static int dalma(int n) {\n  return dalma(n + 1);\n}\n\nint netice = dalma(1);`,
         tr:`static int dal(int n) {\n  return dal(n + 1);\n}\n\nint sonuc = dal(1);`,
         en:`static int dive(int n) {\n  return dive(n + 1);\n}\n\nint result = dive(1);`}},
  {group:'stack',
   name:{az:'Pass-by-value: method-a nə gedir?', tr:'Pass-by-value: method\'a ne gider?', en:'Pass-by-value: what reaches a method?'},
   code:{az:`static void deyis(int x, int[] m) {\n  x = 99;\n  m[0] = 99;\n  m = new int[]{7};\n}\n\nint a = 1;\nint[] d = {1, 2};\ndeyis(a, d);\nint n = d[0];`,
         tr:`static void degistir(int x, int[] m) {\n  x = 99;\n  m[0] = 99;\n  m = new int[]{7};\n}\n\nint a = 1;\nint[] d = {1, 2};\ndegistir(a, d);\nint n = d[0];`,
         en:`static void change(int x, int[] m) {\n  x = 99;\n  m[0] = 99;\n  m = new int[]{7};\n}\n\nint a = 1;\nint[] d = {1, 2};\nchange(a, d);\nint n = d[0];`}},
  {group:'stack',
   name:{az:'Recursion: faktorial', tr:'Recursion: faktöriyel', en:'Recursion: factorial'},
   code:{az:`static int faktorial(int n) {\n  if (n <= 1) {\n    return 1;\n  }\n  return n * faktorial(n - 1);\n}\n\nint netice = faktorial(3);`,
         tr:`static int faktoriyel(int n) {\n  if (n <= 1) {\n    return 1;\n  }\n  return n * faktoriyel(n - 1);\n}\n\nint sonuc = faktoriyel(3);`,
         en:`static int factorial(int n) {\n  if (n <= 1) {\n    return 1;\n  }\n  return n * factorial(n - 1);\n}\n\nint result = factorial(3);`}},
  {group:'stack',
   name:{az:'try/catch: stack unwinding', tr:'try/catch: stack unwinding', en:'try/catch: how the stack unwinds'},
   code:{az:`static int bol(int a, int b) {\n  return a / b;\n}\n\nstatic int hesabla(int x) {\n  int y = bol(x, 0);\n  return y + 1;\n}\n\ntry {\n  int n = hesabla(10);\n} catch (ArithmeticException e) {\n  System.out.println(e.getMessage());\n} finally {\n  System.out.println("son");\n}`,
         tr:`static int bol(int a, int b) {\n  return a / b;\n}\n\nstatic int hesapla(int x) {\n  int y = bol(x, 0);\n  return y + 1;\n}\n\ntry {\n  int n = hesapla(10);\n} catch (ArithmeticException e) {\n  System.out.println(e.getMessage());\n} finally {\n  System.out.println("son");\n}`,
         en:`static int divide(int a, int b) {\n  return a / b;\n}\n\nstatic int compute(int x) {\n  int y = divide(x, 0);\n  return y + 1;\n}\n\ntry {\n  int n = compute(10);\n} catch (ArithmeticException e) {\n  System.out.println(e.getMessage());\n} finally {\n  System.out.println("end");\n}`}},
  {group:'basics',
   name:{az:'2D array: array-lərin array-i', tr:'2D array: array\'lerin array\'i', en:'2D array: an array of arrays'},
   code:{az:`int[][] c = {{1, 2}, {3, 4}};\nint[] setir = c[0];\nsetir[1] = 9;\nint n = c[0][1];`,
         tr:`int[][] t = {{1, 2}, {3, 4}};\nint[] satir = t[0];\nsatir[1] = 9;\nint n = t[0][1];`,
         en:`int[][] grid = {{1, 2}, {3, 4}};\nint[] row = grid[0];\nrow[1] = 9;\nint n = grid[0][1];`}},
  {group:'text',
   name:{az:'String immutable-dır: + yeni object-dir', tr:'String immutable\'dır: + yeni object\'tir', en:'String never changes: + makes a new object'},
   code:{az:`String s = "a";\ns = s + "b";\ns = s + "c";\nString boyuk = s.toUpperCase();`,
         tr:`String s = "a";\ns = s + "b";\ns = s + "c";\nString buyuk = s.toUpperCase();`,
         en:`String s = "a";\ns = s + "b";\ns = s + "c";\nString upper = s.toUpperCase();`}},
  {group:'text',
   name:{az:'StringBuilder: tək array', tr:'StringBuilder: tek array', en:'StringBuilder: one array'},
   code:{az:`StringBuilder sb = new StringBuilder(4);\nsb.append("sa");\nsb.append("lam");\nint tutum = sb.capacity();\nString s = sb.toString();`,
         tr:`StringBuilder sb = new StringBuilder(4);\nsb.append("me");\nsb.append("rha");\nint kapasite = sb.capacity();\nString s = sb.toString();`,
         en:`StringBuilder sb = new StringBuilder(4);\nsb.append("he");\nsb.append("llo");\nint capacity = sb.capacity();\nString s = sb.toString();`}},
  {group:'oop',
   name:{az:'static: hamı üçün bir value', tr:'static: herkes için tek value', en:'static: one value for everyone'},
   code:{az:`class Sayac {\n  static int umumi = 0;\n  int oz = 0;\n\n  Sayac() {\n    umumi++;\n    oz++;\n  }\n}\n\nSayac a = new Sayac();\nSayac b = new Sayac();\nint n = Sayac.umumi;`,
         tr:`class Sayac {\n  static int toplam = 0;\n  int kendi = 0;\n\n  Sayac() {\n    toplam++;\n    kendi++;\n  }\n}\n\nSayac a = new Sayac();\nSayac b = new Sayac();\nint n = Sayac.toplam;`,
         en:`class Counter {\n  static int total = 0;\n  int own = 0;\n\n  Counter() {\n    total++;\n    own++;\n  }\n}\n\nCounter a = new Counter();\nCounter b = new Counter();\nint n = Counter.total;`}},
  {group:'oop',
   name:{az:'Inheritance: tək object, iki class', tr:'Inheritance: tek object, iki class', en:'Inheritance: one object, two classes'},
   code:{az:`class Heyvan {\n  String ad;\n\n  Heyvan(String ad) {\n    this.ad = ad;\n  }\n\n  String ses() {\n    return "...";\n  }\n}\n\nclass It extends Heyvan {\n  int yas;\n\n  It(String ad, int yas) {\n    super(ad);\n    this.yas = yas;\n  }\n\n  String ses() {\n    return "Hav";\n  }\n}\n\nHeyvan h = new It("Rex", 3);\nString s = h.ses();`,
         tr:`class Hayvan {\n  String ad;\n\n  Hayvan(String ad) {\n    this.ad = ad;\n  }\n\n  String ses() {\n    return "...";\n  }\n}\n\nclass Kopek extends Hayvan {\n  int yas;\n\n  Kopek(String ad, int yas) {\n    super(ad);\n    this.yas = yas;\n  }\n\n  String ses() {\n    return "Hav";\n  }\n}\n\nHayvan h = new Kopek("Rex", 3);\nString s = h.ses();`,
         en:`class Animal {\n  String name;\n\n  Animal(String name) {\n    this.name = name;\n  }\n\n  String sound() {\n    return "...";\n  }\n}\n\nclass Dog extends Animal {\n  int age;\n\n  Dog(String name, int age) {\n    super(name);\n    this.age = age;\n  }\n\n  String sound() {\n    return "Woof";\n  }\n}\n\nAnimal a = new Dog("Rex", 3);\nString s = a.sound();`}},
  {group:'oop',
   name:{az:'enum: hər constant tək object-dir', tr:'enum: her constant tek object\'tir', en:'enum: each constant is one object'},
   code:{az:`enum Reng { QIRMIZI, YASIL }\n\nReng a = Reng.YASIL;\nReng b = Reng.YASIL;\nboolean eyni = a == b;\nint sira = a.ordinal();`,
         tr:`enum Renk { KIRMIZI, YESIL }\n\nRenk a = Renk.YESIL;\nRenk b = Renk.YESIL;\nboolean ayni = a == b;\nint sira = a.ordinal();`,
         en:`enum Color { RED, GREEN }\n\nColor a = Color.GREEN;\nColor b = Color.GREEN;\nboolean same = a == b;\nint order = a.ordinal();`}},
  {group:'oop',
   name:{az:'record: equals özü yazılır', tr:'record: equals kendiliğinden yazılır', en:'record: equals comes built in'},
   code:{az:`record Noqte(int x, int y) {}\n\nNoqte a = new Noqte(1, 2);\nNoqte b = new Noqte(1, 2);\nboolean ref = a == b;\nboolean mezmun = a.equals(b);\nint x = a.x();`,
         tr:`record Nokta(int x, int y) {}\n\nNokta a = new Nokta(1, 2);\nNokta b = new Nokta(1, 2);\nboolean ref = a == b;\nboolean icerik = a.equals(b);\nint x = a.x();`,
         en:`record Point(int x, int y) {}\n\nPoint a = new Point(1, 2);\nPoint b = new Point(1, 2);\nboolean ref = a == b;\nboolean content = a.equals(b);\nint x = a.x();`}},
  {group:'list',
   name:{az:'LinkedList: array-siz list', tr:'LinkedList: array\'siz list', en:'LinkedList: a list with no array'},
   code:{az:`LinkedList<String> adlar = new LinkedList<>();\nadlar.add("Aysel");\nadlar.add("Murad");\nadlar.addFirst("Leyla");\n\nString s = adlar.get(1);\nadlar.remove(1);`,
         tr:`LinkedList<String> adlar = new LinkedList<>();\nadlar.add("Ayşe");\nadlar.add("Mert");\nadlar.addFirst("Elif");\n\nString s = adlar.get(1);\nadlar.remove(1);`,
         en:`LinkedList<String> names = new LinkedList<>();\nnames.add("Alice");\nnames.add("Bob");\nnames.addFirst("Carol");\n\nString s = names.get(1);\nnames.remove(1);`}},
  {group:'map',
   name:{az:'HashSet: daxildə HashMap', tr:'HashSet: içinde HashMap', en:'HashSet: a HashMap inside'},
   code:{az:`Set<String> adlar = new HashSet<>();\nboolean a = adlar.add("Aysel");\nboolean b = adlar.add("Leyla");\nboolean c = adlar.add("Aysel");\n\nboolean tapildi = adlar.contains("Leyla");`,
         tr:`Set<String> adlar = new HashSet<>();\nboolean a = adlar.add("Ayşe");\nboolean b = adlar.add("Mert");\nboolean c = adlar.add("Ayşe");\n\nboolean bulundu = adlar.contains("Mert");`,
         en:`Set<String> names = new HashSet<>();\nboolean a = names.add("Alice");\nboolean b = names.add("Bob");\nboolean c = names.add("Alice");\n\nboolean found = names.contains("Bob");`}},
];
const sampleIndexOf = code => SAMPLES.findIndex(s => Object.values(s.code).includes(code));
const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>';
const ICON_STOP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1"/><rect x="13.5" y="5" width="4.5" height="14" rx="1"/></svg>';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function ordinal(n) {
  const tens = {10:'cu',20:'ci',30:'cu',40:'cı',50:'ci',60:'cı',70:'ci',80:'ci',90:'cı',0:'cü'};
  const ones = {1:'ci',2:'ci',3:'cü',4:'cü',5:'ci',6:'cı',7:'ci',8:'ci',9:'cu'};
  return n + '-' + (n % 10 ? ones[n % 10] : tens[n % 100]);
}
const rich = s => esc(nb(s)).replace(/`([^`]+)`/g, '<code>$1</code>');
const kindOf = o => !o ? 'obj' : o.kind === 'string' ? 'str' : o.kind === 'box' ? 'box' : o.kind === 'array' ? 'arr' : 'obj';

let steps = [], cur = 0, timer = null, byId = {};
const STORE = 'java-yaddas-kod', LANG_STORE = 'java-yaddas-dil';

function highlight(line) {
  const KW = /^(?:int|long|short|byte|char|float|double|boolean|void|class|new|static|final|public|private|protected|return|if|else|for|while|break|continue|null|true|false|this|var|import)$/;
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(\b\d[\d_.]*[lLfFdD]?\b)|([A-Za-z_$][\w$]*)/g;
  let out = '', i = 0, m;
  while ((m = re.exec(line))) {
    out += esc(line.slice(i, m.index));
    if (m[1]) out += `<span class="t-c">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="t-s">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="t-n">${esc(m[3])}</span>`;
    else if (KW.test(m[4])) out += `<span class="t-k">${m[4]}</span>`;
    else if (/^[A-Z]/.test(m[4])) out += `<span class="t-t">${esc(m[4])}</span>`;
    else out += esc(m[4]);
    i = m.index + m[0].length;
  }
  return out + esc(line.slice(i));
}
function paintEditor(activeLine, isErr) {
  const lines = $('code').value.split('\n');
  $('hl').innerHTML = lines.map((l, i) => {
    const on = i + 1 === activeLine;
    return `<span class="ln${on ? (isErr ? ' bad' : ' on') : ''}" data-n="${i + 1}">${highlight(l) || ' '}</span>`;
  }).join('');
  syncScroll();
}
function syncScroll() { $('hl').scrollTop = $('code').scrollTop; $('hl').scrollLeft = $('code').scrollLeft; }

function valHtml(v, srcKey) {
  if (v === undefined || v === null) return `<span class="nul">${t('noValue')}</span>`;
  if (v.r === undefined) return `<span class="val">${esc(fmtPrim(v.t, v.v))}</span>`;
  if (v.r === null) return '<span class="nul">null</span>';
  return `<i class="dot k-${kindOf(byId[v.r])}" data-src="${esc(srcKey)}" data-to="${v.r}"></i>`;
}
function cellCols(n) {
  if (n <= 6) return Math.max(n, 1);
  let c = Math.ceil(Math.sqrt(n));
  if (n % c) c++;
  return Math.min(c, 8);
}
function objHtml(o, touched) {
  const born = touched.has('b' + o.id), hit = !born && touched.has('o' + o.id);
  const cls = `obj k-${kindOf(o)}${o.gone ? ' gone' : ''}${born ? ' fresh' : ''}${hit ? ' pulse' : ''}`;
  const goneTag = o.gone ? `<span class="gone-tag">${t('gone')}</span>` : '';
  let body = '';
  if (o.kind === 'string') body = `<small>String</small><b>"${esc(o.value)}"</b>`;
  else if (o.kind === 'box') body = `<small>${o.cls}</small><b>${esc(fmtPrim(o.inner, o.value))}</b>`;
  else if (o.kind === 'array') {
    const cells = o.elems.map((v, i) => `<div class="cell"${v.r ? ' tabindex="0"' : ''}>${o.sb && !v.v ? '<span class="nul">·</span>' : valHtml(v, 'o' + o.id + 'e' + i)}<em>${i}</em></div>`).join('');
    const sub = o.zone === 'shared' ? t('shared') : t('length')(o.elems.length);
    body = `<small>${esc(o.cls)} <i>${sub}</i></small>` + (o.elems.length ? `<div class="cells" style="--cols:${cellCols(o.elems.length)}">${cells}</div>` : '');
  } else {
    const rows = o.fields.map(f => `<div class="row"${f.val && f.val.r ? ' tabindex="0"' : ''}><span class="fname"><small>${esc(f.t)}</small> ${f.from ? `<small>${esc(f.from)}.</small>` : ''}${esc(f.name)}</span>${valHtml(f.val, 'o' + o.id + 'f' + f.name)}</div>`).join('');
    body = `<small>${esc(o.cls)}${o.statics ? ` <i>${t('statics')}</i>` : ''}${o.label ? ` <i>${esc(o.label)}</i>` : ''}</small>` + (rows ? `<div class="rows">${rows}</div>` : '');
  }
  return `<div class="${cls}" tabindex="0" data-obj="${o.id}">${body}${goneTag}</div>`;
}
/* Puts each free object in a lane by its distance from the stack, so references flow left to right. */
function lanes(st) {
  const refs = o => (o.kind === 'array' ? o.elems : o.kind === 'object' ? o.fields.map(f => f.val) : []).filter(v => v && v.r).map(v => v.r);
  const inUse = new Set(st.heap.flatMap(o => refs(o)));
  const isLeaf = o => !!o.label || (o.zone === 'free' && (o.kind === 'string' || o.kind === 'box'));
  const inLane = o => !isLeaf(o) && (o.zone === 'free' || (o.zone === 'shared' && inUse.has(o.id)));
  const depth = {}, out = [];
  const place = (id, d) => {
    const o = byId[id];
    if (!o || !inLane(o) || depth[id] !== undefined) return false;
    depth[id] = d; (out[d] = out[d] || []).push(o);
    return true;
  };
  const walk = seeds => {
    let queue = seeds.filter(id => place(id, 0));
    while (queue.length) {
      const next = [];
      for (const id of queue) {
        const o = byId[id];
        // A bucket's chain hangs below its first Node, the way a linked list reads
        const chain = o.cls === 'HashMap.Node' || o.cls === 'LinkedList.Node' ? o.fields.find(f => f.name === 'next').val.r : o.cls === 'HashSet' ? o.fields[0].val.r : null;
        if (chain && place(chain, depth[id])) next.push(chain);
        for (const r of refs(o)) if (place(r, depth[id] + 1)) next.push(r);
      }
      queue = next;
    }
  };
  const fromStack = [];
  [...st.frames].reverse().forEach(f => f.vars.forEach(v => { if (v.val && v.val.r) fromStack.push(v.val.r); }));
  walk(fromStack);
  walk(st.heap.filter(o => o.statics).map(o => o.id));
  // Unreachable objects last: start from those nothing else points at
  const pointed = new Set(st.heap.flatMap(o => refs(o)));
  walk(st.heap.filter(o => inLane(o) && !pointed.has(o.id)).map(o => o.id));
  walk(st.heap.filter(inLane).map(o => o.id));
  return out.filter(Boolean);
}
function placeTags(st) {
  const tags = [];
  if (st.touched.some(k => k[0] === 'v')) tags.push(['k-stack', 'Stack']);
  const zones = new Set(st.touched.filter(k => k[0] === 'o').map(k => byId[k.slice(1)]).filter(Boolean).map(o => o.zone));
  if (zones.has('free')) tags.push(['k-obj', 'Heap']);
  if (zones.has('pool')) tags.push(['k-str', 'String Pool']);
  if (zones.has('cache')) tags.push(['k-box', t('cache')]);
  return tags.map(([k, t]) => `<span class="pill ${k}">${t}</span>`).join('');
}
function render(animate) {
  const st = steps[cur];
  if (!st) return;
  byId = {}; st.heap.forEach(o => { byId[o.id] = o; });
  const touched = new Set(animate ? st.touched : []);
  const err = st.error;

  // Stack: newest frame on top
  const fi = st.frames.map((f, i) => [f, i]).reverse();
  $('frames').innerHTML = fi.map(([f, i], pos) => {
    const slots = f.vars.map(v => {
      const key = 'v' + i + ':' + v.name, fresh = touched.has(key);
      const ref = v.val && v.val.r;
      return `<div class="slot${fresh ? ' fresh' : ''}"${ref ? ' tabindex="0"' : ''}>
        <span class="nm"><small>${esc(v.t)}</small><b>${esc(v.name)}</b></span>${valHtml(v.val, key)}</div>`;
    }).join('') || `<div class="slot empty-note">${t('emptyFrame')}</div>`;
    return `<div class="frame${pos === 0 ? ' top' : ''}"><h3>${esc(f.name)}</h3>${slots}</div>`;
  }).join('') || `<div class="slot empty-note">${t('emptyStack')}</div>`;

  // Heap
  const zone = z => st.heap.filter(o => o.zone === z);
  const pool = zone('pool'), cache = zone('cache');
  const zones = [];
  if (pool.length) zones.push(`<div class="zone k-str"><h3>String Pool</h3><p>${t('poolText')}</p><div class="items">${pool.map(o => objHtml(o, touched)).join('')}</div></div>`);
  if (cache.length) zones.push(`<div class="zone k-box"><h3>${t('cache')}</h3><p>${t('cacheText')}</p><div class="items">${cache.map(o => objHtml(o, touched)).join('')}</div></div>`);
  let html = '<div class="heap-grid" id="grid">';
  for (const lane of lanes(st)) html += `<div class="lane">${lane.map(o => objHtml(o, touched)).join('')}</div>`;
  const leaves = st.heap.filter(o => (o.label && o.zone === 'shared') || (o.zone === 'free' && (o.kind === 'string' || o.kind === 'box')));
  if (leaves.length) zones.unshift(`<div class="leaves">${leaves.map(o => objHtml(o, touched)).join('')}</div>`);
  if (zones.length) html += `<div class="zones">${zones.join('')}</div>`;
  html += '</div>';
  if (!st.heap.length) html = `<p class="empty-heap">${t('emptyHeap')}</p>`;
  $('heap-body').innerHTML = html;
  fitHeap();

  // Explanation
  const why = $('why');
  why.scrollTop = 0;
  why.classList.toggle('bad', !!err);
  if (err) {
    why.innerHTML = `<div class="why-head"><h2>${t(err.kind === 'compile' ? 'compileErr' : 'runtimeErr')(st.line)}</h2></div><ul><li>${rich(err.msg)}</li></ul>`;
  } else if (cur === 0 && !st.notes.length) {
    why.innerHTML = `<div class="why-head"><h2>${t('start')}</h2></div><ul><li>${t('startText')}</li></ul>`;
  } else {
    why.innerHTML = `<div class="why-head"><h2>${st.line ? t('happened')(st.line) : t('start')}</h2>${placeTags(st)}</div><ul>${st.notes.map(n => `<li>${rich(n)}</li>`).join('') || `<li>${t('noChange')}</li>`}</ul>`;
  }
  const o = $('out');
  o.hidden = !st.out.length;
  o.textContent = st.out.join('');

  // Transport
  $('scrub').max = steps.length - 1; $('scrub').value = cur;
  $('count').textContent = t('step')(cur + 1, steps.length);
  $('prev').disabled = cur === 0; $('next').disabled = cur === steps.length - 1;
  paintEditor(st.line, !!err);
  requestAnimationFrame(() => drawWires(animate ? st : null));
}
/* Scales wide object graphs down a little before asking the viewer to scroll sideways. */
function fitHeap() {
  const grid = $('grid');
  if (!grid) return;
  grid.style.zoom = 1; grid.style.gap = '';
  if (window.matchMedia('(max-width: 640px)').matches) return;
  const heap = $('heap'), cs = getComputedStyle(heap);
  const stackW = document.querySelector('.stack').offsetWidth;
  const outer = getComputedStyle($('inner'));
  const avail = $('map').clientWidth - stackW - parseFloat(outer.paddingLeft) - parseFloat(outer.paddingRight) - parseFloat(outer.columnGap) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2;
  if (grid.offsetWidth > avail) grid.style.gap = '30px';
  const need = grid.offsetWidth;
  if (need > avail) grid.style.zoom = Math.max(.8, avail / need);
}
function drawWires(st) {
  const inner = $('inner'), base = inner.getBoundingClientRect(), g = $('wire-group');
  const narrow = window.matchMedia('(max-width: 640px)').matches;
  const touched = st ? new Set(st.touched) : new Set();
  const dots = [...inner.querySelectorAll('.dot[data-to]')];
  const usage = {}, order = {};
  dots.forEach(d => { usage[d.dataset.to] = (usage[d.dataset.to] || 0) + 1; });
  let svg = '';
  for (const d of dots) {
    const to = d.dataset.to, t = inner.querySelector(`[data-obj="${to}"]`);
    if (!t) continue;
    const a = d.getBoundingClientRect(), b = t.getBoundingClientRect();
    const x1 = a.left + a.width / 2 - base.left, y1 = a.top + a.height / 2 - base.top;
    const n = (order[to] = (order[to] || 0) + 1), total = usage[to];
    const spread = Math.max(0, Math.min(b.height - 14, 11 * (total - 1)));
    const yEnd = b.top + b.height / 2 - base.top + (total > 1 ? (n - 1) / (total - 1) * spread - spread / 2 : 0);
    const left = b.left - base.left, right = b.right - base.left;
    let path;
    if (narrow && d.dataset.src[0] === 'v') {
      const xE = right - 16 - (n - 1) * 9, yE = b.top - base.top;
      path = `M${x1} ${y1}C${x1} ${y1 + 50},${xE} ${yE - 40},${xE} ${yE - 2}`;
    } else if (x1 <= left - 4) {
      const c = Math.max(26, (left - x1) * .5);
      path = `M${x1} ${y1}C${x1 + c} ${y1},${left - c} ${yEnd},${left - 2} ${yEnd}`;
    } else if (x1 >= right + 4) {
      const c = Math.max(26, (x1 - right) * .5);
      path = `M${x1} ${y1}C${x1 - c} ${y1},${right + c} ${yEnd},${right + 2} ${yEnd}`;
    } else {
      const below = b.top - base.top > y1, yE = below ? b.top - base.top : b.bottom - base.top, s = below ? 1 : -1, xE = (left + right) / 2;
      path = `M${x1} ${y1}C${x1} ${y1 + s * 34},${xE} ${yE - s * 34},${xE} ${yE - s * 2}`;
    }
    const m = d.dataset.src.match(/^o(\d+)/), ownerEl = m && inner.querySelector(`[data-obj="${m[1]}"]`);
    const dead = !!ownerEl && ownerEl.classList.contains('gone');
    const fresh = st && !dead && (touched.has(d.dataset.src) || touched.has('b' + to) || (m && touched.has('b' + m[1])));
    const kind = t.className.match(/k-(\w+)/)[1];
    svg += `<path class="wire k-${kind}${dead ? ' dead' : ''}${fresh ? ' fresh' : ''}" data-src="${esc(d.dataset.src)}" data-to="${to}" d="${path}" marker-end="url(#tip-${dead ? 'dead' : kind})"/>`;
  }
  g.innerHTML = svg;
  g.querySelectorAll('.wire.fresh').forEach(p => p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 'px'));
  setTimeout(() => g.querySelectorAll('.wire.fresh').forEach(p => p.classList.remove('fresh')), 480);
}
/* Hover, focus or tap: a reference lights up its target; an object lights up everything that points at it. */
function setHot(el) {
  const inner = $('inner');
  inner.querySelectorAll('.hot').forEach(x => x.classList.remove('hot'));
  inner.classList.remove('dim');
  if (!el) return;
  const d = el.classList.contains('obj') ? null : el.querySelector(':scope > .dot');
  if (d) {
    inner.classList.add('dim');
    const w = inner.querySelector(`.wire[data-src="${CSS.escape(d.dataset.src)}"]`);
    if (w) w.classList.add('hot');
    const t = inner.querySelector(`[data-obj="${d.dataset.to}"]`);
    if (t) t.classList.add('hot');
  } else if (el.classList.contains('obj')) {
    const incoming = inner.querySelectorAll(`.wire[data-to="${el.dataset.obj}"]`);
    if (!incoming.length) return;
    inner.classList.add('dim');
    incoming.forEach(w => w.classList.add('hot'));
    el.classList.add('hot');
  }
}
function compile() {
  stopPlay();
  try { steps = run($('code').value); }
  catch (e) { steps = [{line:0, notes:[], touched:[], frames:[], heap:[], out:[], error:{kind:'compile', msg:t('unreadable')}}]; console.error(e); }
  cur = steps.length - 1;
  render(true);
}
function showActiveLine() {
  const st = steps[cur];
  if (!st || !st.line) return;
  const ta = $('code'), y = (st.line - 1) * 24;
  if (y < ta.scrollTop || y > ta.scrollTop + ta.clientHeight - 48) { ta.scrollTop = Math.max(0, y - 48); syncScroll(); }
}
function step(i) {
  const n = Math.max(0, Math.min(steps.length - 1, i));
  const changed = n !== cur;
  cur = n; render(changed);
  showActiveLine();
}
function stopPlay() { if (timer) { clearInterval(timer); timer = null; paintPlay(); } }
function togglePlay() {
  if (timer) return stopPlay();
  if (cur >= steps.length - 1) step(0);
  $('play').innerHTML = ICON_STOP + t('stop');
  timer = setInterval(() => { if (cur >= steps.length - 1) stopPlay(); else step(cur + 1); }, 1600);
}

function paintPlay() { $('play').innerHTML = timer ? ICON_STOP + t('stop') : ICON_PLAY + t('play'); }
function paintSamples(selected) {
  const sel = $('samples'), groups = {};
  sel.textContent = '';
  SAMPLES.forEach((s, i) => {
    if (!groups[s.group]) { groups[s.group] = document.createElement('optgroup'); groups[s.group].label = t('groups')[s.group]; sel.appendChild(groups[s.group]); }
    const o = document.createElement('option'); o.value = i; o.textContent = s.name[LANG]; groups[s.group].appendChild(o);
  });
  const own = document.createElement('option');
  own.value = 'own'; own.textContent = t('own'); sel.appendChild(own);
  sel.value = selected;
}
/* Translates the page and recompiles at the same step. An unedited example also switches to the new language; the user's own code is left alone. */
function setLang(lang, keepStep) {
  LANG = lang;
  document.documentElement.lang = lang;
  for (const k of ['title', 'lede', 'pick', 'prev', 'next', 'stackHint', 'keyValue', 'keyRef', 'model']) $('t-' + k).textContent = t(k);
  $('desk').setAttribute('aria-label', t('desk'));
  $('map').setAttribute('aria-label', t('map'));
  $('out').setAttribute('aria-label', t('out'));
  $('code').setAttribute('aria-label', t('code'));
  $('scrub').setAttribute('aria-label', t('scrub'));
  document.querySelectorAll('.langs').forEach(g => {
    g.setAttribute('aria-label', t('langs'));
    g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  });
  paintPlay();
  const idx = sampleIndexOf($('code').value);
  if (idx >= 0) { $('code').value = SAMPLES[idx].code[lang]; saveDraft(); }
  paintSamples(idx >= 0 ? String(idx) : 'own');
  try { localStorage.setItem(LANG_STORE, lang); } catch (e) {}
  const keep = cur;
  compile();
  if (keepStep && keep < steps.length) { cur = keep; render(false); }
  showActiveLine();
  paintSite();
}
function firstLang() {
  const fromHash = parseHash().lang;
  if (fromHash) return fromHash;
  try { const s = localStorage.getItem(LANG_STORE); if (UI[s]) return s; } catch (e) {}
  for (const l of navigator.languages || [navigator.language || '']) { const b = l.slice(0, 2).toLowerCase(); if (UI[b]) return b; }
  return 'en';
}
document.addEventListener('click', e => {
  const b = e.target.closest('.langs button');
  if (!b || b.dataset.lang === LANG) return;
  stopPlay();
  setLang(b.dataset.lang, true);
  try { history.replaceState(null, '', '#' + route + '-' + b.dataset.lang); } catch (err) {}
});
$('samples').addEventListener('change', e => {
  if (e.target.value === 'own') return;
  $('code').value = SAMPLES[+e.target.value].code[LANG]; $('code').scrollTop = 0;
  saveDraft(); compile(); showActiveLine();
});
function saveDraft() { try { localStorage.setItem(STORE, $('code').value); } catch (e) {} }
let debounce;
$('code').addEventListener('input', () => {
  $('samples').value = 'own'; saveDraft();
  paintEditor(0, false);
  clearTimeout(debounce); debounce = setTimeout(compile, 180);
});
$('code').addEventListener('scroll', syncScroll);
$('prev').onclick = () => { stopPlay(); step(cur - 1); };
$('next').onclick = () => { stopPlay(); step(cur + 1); };
$('play').onclick = togglePlay;
$('scrub').oninput = e => { stopPlay(); step(+e.target.value); };
document.addEventListener('keydown', e => {
  if (['TEXTAREA', 'INPUT', 'SELECT'].includes(e.target.tagName)) return;
  if (route === 'jvm') {
    if (e.key === 'ArrowRight') { stopPlay(); step(cur + 1); }
    if (e.key === 'ArrowLeft') { stopPlay(); step(cur - 1); }
  } else if (route === 'hashmap') {
    if (e.key === 'ArrowRight') hmChapter(hmCh + 1);
    if (e.key === 'ArrowLeft') hmChapter(hmCh - 1);
  } else if (LS_ORDER.includes(route)) {
    const stepper = $('ls-ctl').querySelector('[data-act="' + (e.key === 'ArrowRight' ? 'next' : 'prev') + '"]');
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (stepper) { if (!stepper.disabled) stepper.click(); }
      else lsChapter(lsCh + (e.key === 'ArrowRight' ? 1 : -1));
    }
  }
});
const hotTarget = e => e.target.closest && e.target.closest('.slot[tabindex], .cell[tabindex], .row[tabindex], .obj');
$('inner').addEventListener('mouseover', e => setHot(hotTarget(e)));
$('inner').addEventListener('mouseleave', () => setHot(null));
$('inner').addEventListener('focusin', e => setHot(hotTarget(e)));
$('inner').addEventListener('focusout', () => setHot(null));
const redraw = () => { fitHeap(); drawWires(null); };
window.addEventListener('resize', redraw);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
