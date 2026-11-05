# How Java Works

Interactive topics that show what happens inside Java. The site is available in Azerbaijani, Turkish and English.

[Azərbaycanca](#java-necə-işləyir)

## Topics

- **JVM: Stack and Heap**: write Java code and follow, line by line, where each variable lands in memory.
- **How HashMap works**: follow a key from `hashCode` to its bucket, bit by bit, through collisions, `resize` and trees.

## What it shows

- Primitives, wrappers, autoboxing and the `Integer` cache
- `String`, the String Pool, `intern()` and `StringBuilder`
- Objects, arrays, `static`, inheritance, interfaces, `enum` and `record`
- `ArrayList`, `LinkedList`, `HashMap` and `HashSet` with their real internal structure
- Method frames, pass-by-value, recursion, `try/catch` and stack unwinding
- Objects that lose their last reference and become eligible for Garbage Collection

## Run it

There is no build step. Open `index.html` in a browser.

## How it works

`index.html` holds a small Java interpreter written in JavaScript. It runs in the browser and records a memory snapshot after each step. It covers a subset of Java, so it does not replace a real JVM.

Collection growth, hash buckets, iteration order and `==` results were compared with OpenJDK 21. One known difference: when a `HashMap` bucket grows past 8 Nodes in a table of at least 64 buckets, Java turns the list into a tree, while this tool keeps drawing a list and says so.

Not supported yet: threads, `TreeMap`, `ArrayDeque`, lambdas, `switch`, generic classes and method overloading.

---

# Java necə işləyir

Java-nın daxilində nə baş verdiyini göstərən interaktiv mövzular. Sayt Azərbaycan, türk və ingilis dillərindədir.

[English](#how-java-works)

## Mövzular

- **JVM: Stack və Heap**: Java kodu yaz və hər variable-ın memory-də hara düşdüyünü sətir-sətir izlə.
- **HashMap necə işləyir**: key-in `hashCode`-dan bucket-ə qədər yolunu bit-bit izlə: collision, `resize` və tree daxil.

## Nəyi göstərir

- Primitive-lər, wrapper-lər, autoboxing və `Integer` cache
- `String`, String Pool, `intern()` və `StringBuilder`
- Object-lər, array-lər, `static`, inheritance, interface-lər, `enum` və `record`
- Real daxili quruluşu ilə `ArrayList`, `LinkedList`, `HashMap` və `HashSet`
- Method frame-ləri, pass-by-value, recursion, `try/catch` və stack unwinding
- Son reference-ini itirən və Garbage Collection üçün uyğun olan object-lər

## Necə işə salmaq olar

Build addımı yoxdur. `index.html` faylını brauzerdə aç.

## Necə işləyir

`index.html` faylında JavaScript ilə yazılmış kiçik Java interpreter-i var. O, brauzerdə işləyir və hər addımdan sonra memory-nin snapshot-unu saxlayır. Java-nın yalnız bir hissəsini əhatə edir, ona görə real JVM-i əvəz etmir.

Collection-ların böyüməsi, hash bucket-ləri, iteration sırası və `==` nəticələri OpenJDK 21 ilə müqayisə olunub. Bir məlum fərq var: `HashMap` bucket-i ən azı 64 bucket-lik table-da 8 Node-u keçəndə Java list-i tree-yə çevirir, bu alət isə list çəkməyə davam edir və bunu açıq deyir.

Hələ dəstəklənmir: thread-lər, `TreeMap`, `ArrayDeque`, lambda-lar, `switch`, generic class-lar və method overloading.
