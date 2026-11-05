# How Java Works

Interactive topics that show what happens inside Java, in Azerbaijani, Turkish and English.

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
