# How Java Works

Interactive topics that show what happens inside Java. The site is available in Azerbaijani, Turkish and English.

[Azərbaycanca](#java-necə-işləyir)

## Topics

- **JVM: Stack and Heap**: write Java code and follow, line by line, where each variable lands in memory.
- **Garbage Collection**: GC roots, mark-sweep, cycles, Eden, Survivor, Old and how memory leaks happen.
- **String inside**: `byte[]`, LATIN1 and UTF16, emoji length, shared arrays and the cost of `+=`.
- **Objects in memory**: the mark word bit by bit, how the JVM orders fields and pads objects, arrays, what collections cost and the 32 GB line.
- **How HashMap works**: follow a key from `hashCode` to its bucket, bit by bit, through collisions, `resize` and trees.
- **How TreeMap works**: watch a red-black tree through insert, recolor, rotation and remove.
- **Threads**: drive two threads yourself through race conditions, `synchronized`, `volatile`, CAS and deadlock.
- **How ConcurrentHashMap works**: CAS on an empty bucket, a lock on a full one, resize and why `null` is rejected.
- **Virtual threads**: a million threads, carriers, mount and unmount, pinning inside `synchronized` and where virtual threads do not help.
- **Bytecode**: real `javap` output run step by step: the operand stack, `i = i++` and what `finally` really is.
- **Class loading**: delegation, the three stages, static and constructor order, and classic traps.
- **How Stream works**: laziness, element-by-element flow, short-circuit, `sorted` and when `count` runs nothing.

## What the JVM map shows

- Primitives, wrappers, autoboxing and the `Integer` cache
- `String`, the String Pool, `intern()` and `StringBuilder`
- Objects, arrays, `static`, inheritance, interfaces, `enum` and `record`
- `ArrayList`, `LinkedList`, `HashMap` and `HashSet` with their real internal structure
- Method frames, pass-by-value, recursion, `try/catch` and stack unwinding
- Objects that lose their last reference and become eligible for Garbage Collection

## Run it

There is no build step. Open `index.html` in a browser.

## Project structure

```
index.html                page markup
css/style.css             all styles
js/i18n.js                language state and Azerbaijani-keyed translations
js/engine/parser.js       Mini Java tokenizer and parser
js/engine/interpreter.js  interpreter that records a memory snapshot per step
js/jvm-map.js             JVM map: rendering, samples and the code editor
js/site.js                home page, routing and the HashMap lesson
js/lessons/lessons.js     shared lesson view
js/lessons/*.js           one file per lesson
js/main.js                start-up
```

The scripts are plain `<script>` files loaded in order, not ES modules, so the page still works when opened straight from disk. A new lesson goes into `js/lessons/`, is added to `LS_ORDER` in `lessons.js`, gets a `<script>` tag before `main.js` and a card on the home page.

## How it works

`index.html` holds a small Java interpreter written in JavaScript. It runs in the browser and records a memory snapshot after each step. It covers a subset of Java, so it does not replace a real JVM.

Collection growth, hash buckets, iteration order and `==` results were compared with OpenJDK 21. One known difference: when a `HashMap` bucket grows past 8 Nodes in a table of at least 64 buckets, Java turns the list into a tree, while this tool keeps drawing a list and says so. `ConcurrentHashMap` bins that become a `TreeBin` are drawn the same way.

The other lessons were checked too: `TreeMap` shape and colors, `ConcurrentHashMap` tables, `Stream` element order, `String` fields, `javap` listings and class initialization output all match OpenJDK 21. Pages say where a lesson uses a simplified model: the generations in Garbage Collection and the visibility example in Threads.

Objects in memory uses the HotSpot field layout algorithm. It was compared with JDK 21 on 600 random classes: the object size and the slot of each field size matched in all of them. Fields of the same size can swap places with each other on a real JVM, because JDK 21 sorts them with an unstable `qsort`. Mark word values, array sizes and collection sizes were measured with `Unsafe` and `Instrumentation`. The numbers in Virtual threads were measured on JDK 21; the carrier timeline is a simplified model with two carriers.

The code editor of the JVM map does not support yet: threads, `TreeMap`, `ArrayDeque`, lambdas, `switch`, generic classes and method overloading.

---

# Java necə işləyir

Java-nın daxilində nə baş verdiyini göstərən interaktiv mövzular. Sayt Azərbaycan, türk və ingilis dillərindədir.

[English](#how-java-works)

## Mövzular

- **JVM: Stack və Heap**: Java kodu yaz və hər variable-ın memory-də hara düşdüyünü sətir-sətir izlə.
- **Garbage Collection**: GC root-lar, mark-sweep, cycle-lar, Eden, Survivor, Old və memory leak-in necə yarandığı.
- **String daxildən**: `byte[]`, LATIN1 və UTF16, emoji-nin uzunluğu, paylaşılan array-lər və `+=`-in qiyməti.
- **Object yaddaşda**: mark word bit-bit, JVM-in field-ləri necə düzdüyü və padding, array-lər, collection-ların qiyməti və 32 GB sərhədi.
- **HashMap necə işləyir**: key-in `hashCode`-dan bucket-ə qədər yolunu bit-bit izlə: collision, `resize` və tree daxil.
- **TreeMap necə işləyir**: red-black tree-ni insert, recolor, rotation və remove boyunca izlə.
- **Thread-lər**: iki thread-i özün idarə et: race condition, `synchronized`, `volatile`, CAS və deadlock.
- **ConcurrentHashMap necə işləyir**: boş bucket-də CAS, dolu bucket-də lock, resize və `null`-un niyə qəbul edilmədiyi.
- **Virtual Thread-lər**: bir milyon thread, carrier-lər, mount və unmount, `synchronized` daxilində pinning və virtual thread-in kömək etmədiyi hallar.
- **Bytecode**: real `javap` çıxışı addım-addım: operand stack, `i = i++` və `finally`-nin həqiqi forması.
- **Class loading**: delegation, üç mərhələ, static və constructor sırası, klassik tələlər.
- **Stream necə işləyir**: lazy iş, element-lərin bir-bir keçməsi, short-circuit, `sorted` və `count`-un nə vaxt heç nə işlətmədiyi.

## JVM xəritəsi nəyi göstərir

- Primitive-lər, wrapper-lər, autoboxing və `Integer` cache
- `String`, String Pool, `intern()` və `StringBuilder`
- Object-lər, array-lər, `static`, inheritance, interface-lər, `enum` və `record`
- Real daxili quruluşu ilə `ArrayList`, `LinkedList`, `HashMap` və `HashSet`
- Method frame-ləri, pass-by-value, recursion, `try/catch` və stack unwinding
- Son reference-ini itirən və Garbage Collection üçün uyğun olan object-lər

## Necə işə salmaq olar

Build addımı yoxdur. `index.html` faylını brauzerdə aç.

## Layihənin quruluşu

```
index.html                səhifənin HTML-i
css/style.css             bütün stillər
js/i18n.js                dil vəziyyəti və tərcümələr (açar Azərbaycan mətnidir)
js/engine/parser.js       Mini Java tokenizer-i və parser-i
js/engine/interpreter.js  hər addımda memory snapshot-u saxlayan interpreter
js/jvm-map.js             JVM xəritəsi: çəkmə, nümunələr və kod redaktoru
js/site.js                ana səhifə, routing və HashMap dərsi
js/lessons/lessons.js     dərslərin ortaq görünüşü
js/lessons/*.js           hər dərs üçün bir fayl
js/main.js                başlanğıc
```

Skriptlər ES module deyil, sıra ilə yüklənən adi `<script>` fayllarıdır. Ona görə səhifə diskdən birbaşa açılanda da işləyir. Yeni dərs `js/lessons/`-a əlavə olunur, `lessons.js`-dəki `LS_ORDER`-ə yazılır, `main.js`-dən əvvəl `<script>` teqi və ana səhifədə kartı alır.

## Necə işləyir

`index.html` faylında JavaScript ilə yazılmış kiçik Java interpreter-i var. O, brauzerdə işləyir və hər addımdan sonra memory-nin snapshot-unu saxlayır. Java-nın yalnız bir hissəsini əhatə edir, ona görə real JVM-i əvəz etmir.

Collection-ların böyüməsi, hash bucket-ləri, iteration sırası və `==` nəticələri OpenJDK 21 ilə müqayisə olunub. Bir məlum fərq var: `HashMap` bucket-i ən azı 64 bucket-lik table-da 8 Node-u keçəndə Java list-i tree-yə çevirir, bu alət isə list çəkməyə davam edir və bunu açıq deyir. `TreeBin`-ə çevrilən `ConcurrentHashMap` bucket-ləri də eyni cür çəkilir.

Digər dərslər də yoxlanılıb: `TreeMap`-in quruluşu və rəngləri, `ConcurrentHashMap` table-ları, `Stream` element sırası, `String` field-ləri, `javap` listing-ləri və class initialization çıxışı OpenJDK 21 ilə eynidir. Dərsin sadələşdirilmiş model işlətdiyi yerlər səhifədə yazılıb: Garbage Collection-da nəsillər və Thread-lərdə visibility nümunəsi.

Object yaddaşda dərsi HotSpot-un field düzülüşü alqoritmini işlədir. O, JDK 21 ilə 600 təsadüfi class-da müqayisə olunub: object-in ölçüsü və hər field ölçüsünün yeri hamısında uyğun gəldi. Eyni ölçülü field-lər real JVM-də öz aralarında yer dəyişə bilər, çünki JDK 21 onları qeyri-sabit `qsort` ilə sıralayır. Mark word dəyərləri, array və collection ölçüləri `Unsafe` və `Instrumentation` ilə ölçülüb. Virtual Thread-lər dərsindəki rəqəmlər JDK 21-də ölçülüb, carrier zaman xətti isə iki carrier-li sadələşdirilmiş modeldir.

JVM xəritəsinin kod redaktoru hələ bunları dəstəkləmir: thread-lər, `TreeMap`, `ArrayDeque`, lambda-lar, `switch`, generic class-lar və method overloading.
