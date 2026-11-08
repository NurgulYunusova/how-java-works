/* ---------- Interpreter ---------- */
class Signal { constructor(kind, val) { this.kind = kind; this.val = val; } }

const isPrim = t => PRIMS.includes(t);
const isNumT = t => t in RANK;
function fmtPrim(t, v) {
  if (t === 'char') return "'" + (v === 0 ? '\\0' : v === 10 ? '\\n' : String.fromCodePoint(v)) + "'";
  return plainPrim(t, v);
}
function plainPrim(t, v) {
  if (t === 'boolean') return String(v);
  if (t === 'char') return String.fromCodePoint(v);
  if (t === 'float' || t === 'double') {
    if (Number.isNaN(v)) return 'NaN';
    if (!Number.isFinite(v)) return v > 0 ? 'Infinity' : '-Infinity';
    const n = t === 'float' ? parseFloat(v.toPrecision(7)) : v;
    return Number.isInteger(n) && Math.abs(n) < 1e7 ? n + '.0' : String(n);
  }
  return String(v);
}
function wrapNum(t, v) {
  switch (t) {
    case 'int': return v | 0;
    case 'long': return Math.trunc(v);
    case 'short': return (v << 16) >> 16;
    case 'byte': return (v << 24) >> 24;
    case 'char': return v & 0xffff;
    case 'float': return Math.fround(v);
    default: return v;
  }
}
const q = s => '`' + s + '`';

function run(src) {
  const parsed = new Parser(tokenize(src)).program();
  return new Interp(parsed).execute();
}

class Interp {
  constructor(prog) {
    this.prog = prog; this.frames = []; this.heap = []; this.byId = {}; this.pool = {}; this.cache = {};
    this.nextId = 1; this.out = []; this.steps = []; this.notes = []; this.touched = []; this.line = 0;
    this.prevGone = new Set(); this.statics = {}; this.error = null;
  }
  note(s) { if (!this.notes.includes(s)) this.notes.push(s); }
  touch(k) { this.touched.push(k); }
  alloc(o) { o.id = this.nextId++; o.line = this.line; this.heap.push(o); this.byId[o.id] = o; this.touch('o' + o.id); this.touch('b' + o.id); return o; }
  refsOf(o) {
    if (o.kind === 'array') return o.elems.filter(v => v && v.r);
    if (o.kind === 'object') return o.fields.map(f => f.val).filter(v => v && v.r);
    return [];
  }
  reachable() {
    const seen = new Set(), todo = [];
    const add = v => { if (v && v.r && !seen.has(v.r)) { seen.add(v.r); todo.push(v.r); } };
    for (const f of this.frames) for (const v of f.vars) add(v.val);
    for (const k in this.statics) { seen.add(this.statics[k].id); todo.push(this.statics[k].id); }
    while (todo.length) for (const v of this.refsOf(this.byId[todo.pop()])) add(v);
    return seen;
  }
  step(line, title) {
    if (this.steps.length >= MAX_STEPS) throw new JavaError('runtime', TX`Proqram ${MAX_STEPS} addımı keçdi, ona görə dayandırıldı. Sonsuz loop ola bilər.`, line);
    const live = this.reachable(), gone = [];
    const heap = this.heap.map(o => {
      const isGone = o.zone === 'free' && !live.has(o.id);
      if (isGone) gone.push(o.id);
      return Object.assign(JSON.parse(JSON.stringify(o)), {gone:isGone});
    });
    const fresh = gone.filter(id => !this.prevGone.has(id));
    if (fresh.length) this.note(fresh.length === 1
      ? TX`Bir object-ə heç bir reference qalmadı. Garbage Collector onu istənilən vaxt silə bilər.`
      : TX`${fresh.length} object-ə heç bir reference qalmadı. Garbage Collector onları istənilən vaxt silə bilər.`);
    this.prevGone = new Set(gone);
    this.steps.push({line, title, notes:this.notes.slice(), touched:this.touched.slice(), frames:JSON.parse(JSON.stringify(this.frames)), heap, out:this.out.slice()});
    this.notes = []; this.touched = [];
  }
  execute() {
    const P = this.prog;
    const mainHolder = Object.values(P.classes).find(c => c.methods.main && c.methods.main.isStatic);
    const mainM = mainHolder ? mainHolder.methods.main : P.methods.main;
    try {
      this.frames.push({name:'main()', vars:[], cls:null, self:null});
      this.frames[0].cls = mainHolder ? mainHolder.name : null;
      if (mainM && mainM.params[0]) {
        const a = this.alloc({kind:'array', zone:'free', cls:'String[]', elems:[], elemT:'String'});
        this.frames[0].vars.push({name:mainM.params[0].name, t:'String[]', val:{t:'String[]', r:a.id}});
      }
      this.touched = [];
      for (const c of Object.values(P.classes)) this.initStatics(c);
      this.step(0, TX`Proqram başlayır`);
      if (mainM) this.execBlock(mainM.body);
      else for (const s of P.body) this.exec(s);
      if (P.error) throw P.error;
    } catch (e) {
      if (e instanceof Signal) { if (e.kind === 'return' && !P.error) {} else if (P.error) this.error = P.error; }
      else if (e instanceof JavaError) this.error = e;
      else throw e;
    }
    if (this.error) {
      this.error.line = this.error.line ?? this.line;
      if (!this.steps.length) this.step(0, TX`Proqram başlayır`);
      const s = JSON.parse(JSON.stringify(this.steps[this.steps.length - 1]));
      s.line = this.error.line; s.error = {kind:this.error.kind, msg:this.error.message};
      s.notes = []; s.touched = []; s.title = '';
      s.frames = JSON.parse(JSON.stringify(this.frames));
      this.steps.push(s);
    }
    return this.steps;
  }
  initStatics(c) {
    const sf = c.fields.filter(f => f.isStatic);
    if (!sf.length && !c.isEnum) return;
    const o = this.alloc({kind:'object', zone:'free', cls:c.name, statics:true, fields:[]});
    this.statics[c.name] = o;
    if (c.isEnum) {
      c.consts.forEach((name, i) => {
        const nm = this.intern(name);
        const k = this.alloc({kind:'object', zone:'free', cls:c.name, isEnumConst:true, fields:[{name:'name', t:'String', val:{t:'String', r:nm.r}}, {name:'ordinal', t:'int', val:{t:'int', v:i}}]});
        o.fields.push({name, t:c.name, val:{t:c.name, r:k.id}});
      });
      this.notes = [];
      this.note(TX`Hər enum constant-ı heap-də tək bir object-dir və proqram boyu eyni qalır. Ona görə enum-ları ${q('==')} ilə müqayisə etmək təhlükəsizdir.`);
      return;
    }
    for (const f of sf) {
      const val = f.init ? this.coerce(this.evalInit(f.init, f.t), f.t, f.line) : this.defaultVal(f.t);
      o.fields.push({name:f.name, t:f.t, val});
    }
    this.note(TX`${q(c.name)} class-ının static field-ləri stack-də deyil, heap-dəki class object-ində saxlanır.`);
  }
  get frame() { return this.frames[this.frames.length - 1]; }

  /* ----- statements ----- */
  execBlock(b) {
    const f = this.frame, mark = f.vars.length;
    try { for (const s of b.stmts) this.exec(s); }
    finally { this.lastDropped = f.vars.splice(mark).map(v => v.name); }
    return this.lastDropped;
  }
  execScoped(b) {
    const dropped = this.execBlock(b);
    if (dropped.length && b.endLine) {
      this.note(TX`Block bitdi: ${dropped.map(q).join(', ')} stack-dən silindi.`);
      this.step(b.endLine);
    }
  }
  exec(s) {
    this.line = s.line;
    switch (s.s) {
      case 'block': return this.execScoped(s);
      case 'decl': return this.execDecl(s);
      case 'expr': {
        this.eval(s.e);
        return this.step(s.line);
      }
      case 'if': {
        const c = this.truth(this.eval(s.cond));
        this.note(TX`Condition ${q(String(c))} oldu.`); this.step(s.line);
        if (c) this.exec(s.th); else if (s.el) this.exec(s.el);
        return;
      }
      case 'while': {
        for (;;) {
          this.line = s.line;
          const c = this.truth(this.eval(s.cond));
          this.note(TX`Condition ${q(String(c))} oldu.`); this.step(s.line);
          if (!c) return;
          try { this.exec(s.body); }
          catch (e) { if (e instanceof Signal && e.kind === 'break') return; if (!(e instanceof Signal && e.kind === 'continue')) throw e; }
        }
      }
      case 'for': {
        const f = this.frame, mark = f.vars.length;
        try {
          for (const i of s.init) this.exec(i);
          for (;;) {
            this.line = s.line;
            if (s.cond) {
              const c = this.truth(this.eval(s.cond));
              this.note(TX`Condition ${q(String(c))} oldu.`); this.step(s.line);
              if (!c) break;
            }
            try { this.exec(s.body); }
            catch (e) { if (e instanceof Signal && e.kind === 'break') break; if (!(e instanceof Signal && e.kind === 'continue')) throw e; }
            for (const u of s.upd) this.exec(u);
          }
        } finally {
          var dropped = f.vars.splice(mark).map(v => v.name);
        }
        if (dropped.length) { this.note(TX`Loop bitdi: ${dropped.map(q).join(', ')} stack-dən silindi.`); this.step(s.line); }
        return;
      }
      case 'foreach': {
        const seq = this.iterable(s.it, s.line);
        const f = this.frame, mark = f.vars.length;
        try {
          for (let i = 0; i < seq.length; i++) {
            this.line = s.line;
            f.vars.splice(mark);
            const t = s.t === 'var' ? seq[i].t : s.t;
            f.vars.push({name:s.name, t, val:this.coerce(seq[i], t, s.line)});
            this.touch('v' + (this.frames.length - 1) + ':' + s.name);
            this.note(TX`${q(s.name)} növbəti elementi aldı (${i + 1} / ${seq.length}).`);
            this.step(s.line);
            try { this.exec(s.body); }
            catch (e) { if (e instanceof Signal && e.kind === 'break') break; if (!(e instanceof Signal && e.kind === 'continue')) throw e; }
          }
        } finally { f.vars.splice(mark); }
        return;
      }
      case 'throw': {
        const v = this.eval(s.e);
        if (v.r === undefined || (v.r && !this.isA(this.classOf(this.byId[v.r]), 'Throwable'))) throw compileErr(TX`${'throw'} yalnız exception object-i ilə işləyir.`, s.line);
        if (v.r === null) throw new JavaError('runtime', TX`NullPointerException: null atmaq olmaz.`, s.line);
        const o = this.byId[v.r], msg = this.fv(o, 'message');
        const err = new JavaError('runtime', o.cls + (msg.r ? ': ' + this.byId[msg.r].value : ''), s.line);
        err.obj = o.id; err.cls = o.cls;
        throw err;
      }
      case 'try': return this.execTry(s);
      case 'return': {
        const v = s.e ? this.eval(s.e) : null;
        throw new Signal('return', v);
      }
      case 'break': throw new Signal('break');
      case 'continue': throw new Signal('continue');
    }
  }
  excClassOf(err) {
    if (err.cls) return err.cls;
    const m = /^(\w+)/.exec(err.message);
    return m && m[1] in EXC ? m[1] : null;
  }
  excObject(err, cls) {
    if (err.obj) return err.obj;
    const text = err.real !== undefined ? err.real : err.message.replace(/^\w+:\s*/, '').replace(/`/g, '');
    const msg = text === null ? {t:'String', r:null} : this.newString(text);
    return this.alloc({kind:'object', zone:'free', cls, fields:[{name:'message', t:'String', val:{t:'String', r:msg.r}}]}).id;
  }
  execTry(s) {
    const depth = this.frames.length, f = this.frame, mark = f.vars.length;
    let pending = null;
    const unwind = () => {
      const gone = this.frames.length - depth;
      this.frames.length = depth;
      f.vars.length = Math.min(f.vars.length, mark);
      return gone;
    };
    try { this.execScoped(s.body); }
    catch (err) {
      pending = err;
      const cls = err instanceof JavaError && err.kind === 'runtime' ? this.excClassOf(err) : null;
      if (cls) {
        const c = s.catches.find(k => k.types.some(t => this.isA(cls, t)));
        const gone = unwind();
        if (gone) this.note(TX`Stack unwinding: exception catch olunana qədər ${gone} frame silindi.`);
        if (c) {
          pending = null;
          const id = this.excObject(err, cls);
          this.line = c.line;
          f.vars.push({name:c.name, t:c.types.length > 1 ? 'Throwable' : c.types[0], val:{t:c.types.length > 1 ? 'Throwable' : c.types[0], r:id}});
          this.touch('v' + (this.frames.length - 1) + ':' + c.name);
          this.touch('o' + id);
          this.note(TX`${q(cls)} catch olundu. Exception da heap-də object-dir, ${q(c.name)} ona reference saxlayır. Proqram dayanmır, ${q('catch')} block-undan davam edir.`);
          this.step(c.line);
          try { this.execBlock(c.body); }
          catch (e2) { pending = e2; if (e2 instanceof JavaError && e2.kind === 'runtime') unwind(); }
          f.vars.length = Math.min(f.vars.length, mark);
        }
      } else if (err instanceof Signal) f.vars.length = Math.min(f.vars.length, mark);
    }
    if (s.fin) {
      if (pending instanceof JavaError && pending.kind === 'runtime') unwind();
      this.note(TX`${q('finally')} xəta olsa da, olmasa da işləyir.`);
      this.step(s.fin.line);
      this.execScoped(s.fin);
    }
    if (pending) throw pending;
  }
  execDecl(s) {
    const f = this.frame;
    if (f.vars.some(v => v.name === s.name)) throw compileErr(TX`${q(s.name)} bu method-da artıq declare olunub. Başqa ad seç.`, s.line);
    let t = s.t, val;
    if (s.init) {
      const raw = this.evalInit(s.init, t);
      if (t === 'var') {
        if (raw.t === 'null') throw compileErr(TX`var variable-ına null vermək olmaz: type müəyyən olunmur.`, s.line);
        t = raw.t;
      }
      val = this.coerce(raw, t, s.line);
      if (s.isFinal && raw.c && (isPrim(t) || t === 'String')) val.c = true;
    } else if (t === 'var') throw compileErr(TX`var variable-ı dərhal value almalıdır.`, s.line);
    const v = {name:s.name, t, val, isFinal:s.isFinal};
    f.vars.push(v);
    this.touch('v' + (this.frames.length - 1) + ':' + s.name);
    if (s.init) this.describeStore(s.name, t, val);
    else this.note(TX`${q(s.name)} üçün stack-də yer ayrıldı, amma value hələ yoxdur. Local variable-lar avtomatik 0 və ya null almır.`);
    this.step(s.line);
  }
  describeStore(name, t, val) {
    if (isPrim(t)) this.note(TX`${q(name)} primitive-dir: ${q(fmtPrim(t, val.v))} value-su birbaşa stack-dəki slot-un içində saxlanır. Heap-ə heç nə getmir.`);
    else if (val.r === null) this.note(TX`${q(name)} slot-unda ${q('null')} var: heç bir object-ə baxmır.`);
    else this.note(TX`${q(name)} slot-u stack-dədir, amma içində object-in özü yox, ona reference saxlanır.`);
  }
  evalInit(e, t) {
    if (e.x === 'arrlit') return this.arrayFromLit(e, e.t || t);
    return this.eval(e);
  }
  truth(v) {
    if (v.t === 'Boolean') { if (v.r === null) throw new JavaError('runtime', TX`NullPointerException: null Boolean true/false-a çevrilə bilmir.`, this.line); return this.byId[v.r].value; }
    if (v.t !== 'boolean') throw compileErr(TX`Condition boolean olmalıdır, ${q(v.t)} verildi.`, this.line);
    return v.v;
  }

  /* ----- conversions ----- */
  defaultVal(t) {
    if (t === 'boolean') return {t, v:false};
    if (isPrim(t)) return {t, v:0};
    return {t, r:null};
  }
  dynType(v) { return v.r ? this.classOf(this.byId[v.r]) : v.t; }
  classOf(o) { return o.kind === 'string' ? 'String' : o.kind === 'box' ? o.cls : o.cls; }
  coerce(v, target, line = this.line) {
    const src = v.t;
    if (src === 'void') throw compileErr(TX`Bu method heç nə qaytarmır (void), onun nəticəsini saxlamaq olmaz.`, line);
    if (src === 'Object' && !['Object'].includes(target) && v.r !== undefined) throw compileErr(TX`Variable-ın type-ı ${q('Object')}-dir, Java onu avtomatik ${q(target)} etmir. Collection-ın type-ını yaz (məsələn ${q('List<Integer>')}) və ya cast et: ${q('(' + target + ') x')}.`, line);
    if (isPrim(target)) {
      if (v.r !== undefined) { // reference to primitive: unboxing
        if (v.r === null) {
          if (src === 'null') throw compileErr(TX`Primitive ${q(target)} type-ına ${q('null')} vermək olmaz. Primitive həmişə value saxlayır.`, line);
          throw new JavaError('runtime', TX`NullPointerException: ${q(src)} null-dur, ondan ${q(target)} value-su çıxarmaq (unboxing) mümkün deyil.`, line);
        }
        const o = this.byId[v.r];
        if (o.kind !== 'box') throw compileErr(TX`Type-lar uyğun gəlmir: ${q(src)} type-ını ${q(target)} type-ına yazmaq olmaz.`, line);
        this.note(TX`Unboxing: ${q(o.cls)} object-inin içindəki value çıxarıldı.`);
        return this.coerce({t:BOX[o.cls], v:o.value}, target, line);
      }
      if (src === target) return {t:target, v:v.v};
      if (src === 'boolean' || target === 'boolean') throw compileErr(TX`Type-lar uyğun gəlmir: ${q(src)} type-ını ${q(target)} type-ına yazmaq olmaz.`, line);
      if (v.c && RANGE[target] && ['byte','short','char','int'].includes(src) && target !== 'int' && v.v >= RANGE[target][0] && v.v <= RANGE[target][1]) return {t:target, v:v.v};
      const widen = RANK[src] < RANK[target] || (RANK[src] === RANK[target] && false);
      const charBad = target === 'char' || (src === 'char' && target === 'short');
      if (!widen || charBad) {
        if (v.c && RANGE[target] && src === 'int') throw compileErr(TX`${q(String(v.v))} value-su ${q(target)} type-ına sığmır (${RANGE[target][0]} ... ${RANGE[target][1]}).`, line);
        throw compileErr(TX`${q(src)} value-sunu ${q(target)} type-ına yazanda məlumat itə bilər. Java buna özü icazə vermir: ${q('(' + target + ')')} ilə cast et.`, line);
      }
      return {t:target, v:wrapNum(target, v.v)};
    }
    if (target in BOX) {
      if (v.r !== undefined) {
        if (v.r === null) return {t:target, r:null};
        const o = this.byId[v.r];
        if (o.kind === 'box' && o.cls === target) return {t:target, r:v.r};
        throw compileErr(TX`Type-lar uyğun gəlmir: ${q(this.classOf(o))} type-ını ${q(target)} type-ına yazmaq olmaz.`, line);
      }
      const inner = BOX[target];
      if (src === inner) return this.box(target, v.v);
      if (v.c && ['byte','short','char'].includes(inner) && ['int','short','byte','char'].includes(src) && v.v >= RANGE[inner][0] && v.v <= RANGE[inner][1]) return this.box(target, v.v);
      throw compileErr(TX`${q(plainPrim(src, v.v))} ${q(src)} type-ındadır və avtomatik ${q(target)} olmur. Autoboxing yalnız öz cütü ilə işləyir: ${q(src)} → ${q(UNBOX_TO[src])}.${target === 'Long' ? TX` Sonuna L yaz: 4L.` : target === 'Double' ? TX` Nöqtə ilə yaz: 4.0.` : target === 'Float' ? TX` Sonuna f yaz: 4f.` : ''}`, line);
    }
    if (target === 'Object' || target === 'Number' || target === 'Comparable') {
      if (v.r !== undefined) return {t:target, r:v.r};
      if (target === 'Number' && src === 'boolean') throw compileErr(TX`boolean Number deyil.`, line);
      const b = this.box(UNBOX_TO[src], v.v);
      return {t:target, r:b.r};
    }
    if (v.r === undefined) throw compileErr(TX`Type-lar uyğun gəlmir: ${q(src)} primitive-ini ${q(target)} type-ına yazmaq olmaz.`, line);
    if (v.r === null) {
      if (target !== 'String' && !target.endsWith('[]') && !this.prog.classes[target] && !knownLib(target)) throw compileErr(TX`${q(target)} type-ı tanınmır. Əvvəlcə class ${target} { ... } yaz.`, line);
      return {t:target, r:null};
    }
    const dyn = this.classOf(this.byId[v.r]);
    if (!this.isA(dyn, target)) throw compileErr(TX`Type-lar uyğun gəlmir: ${q(dyn)} type-ını ${q(target)} type-ına yazmaq olmaz.`, line);
    const declared = erase(v.t);
    if (this.prog.classes[declared] && !this.isA(declared, target)) throw compileErr(TX`${q(declared)} variable-ı avtomatik ${q(target)} olmur, object elə olsa belə. Cast et: ${q('(' + target + ') x')}.`, line);
    const ga = genArgs(v.t), gb = genArgs(target);
    if (ga.length && gb.length && ga.join() !== gb.join()) throw compileErr(TX`Generic type-lar uyğun gəlmir: ${q(v.t)} type-ını ${q(target)} type-ına yazmaq olmaz.`, line);
    const out = {t:target, r:v.r};
    return out;
  }
  box(cls, value) {
    const inner = BOX[cls];
    let cachedRange = false;
    if (cls === 'Boolean' || cls === 'Byte') cachedRange = true;
    else if (cls === 'Character') cachedRange = value >= 0 && value <= 127;
    else if (cls === 'Short' || cls === 'Integer' || cls === 'Long') cachedRange = value >= -128 && value <= 127;
    const label = fmtPrim(inner, value);
    if (cachedRange) {
      const key = cls + ':' + value;
      let o = this.cache[key];
      if (!o) { o = this.alloc({kind:'box', zone:'cache', cls, value, inner}); this.cache[key] = o; }
      else this.touch('o' + o.id);
      const range = cls === 'Character' ? "0 ... 127" : cls === 'Boolean' ? 'true/false' : '−128 ... 127';
      this.note(TX`Autoboxing: ${q(cls + '.valueOf(' + label + ')')} çağırılır. ${q(label)} cache aralığındadır (${range}), ona görə yeni object yaradılmır, hazır cache object-i qaytarılır.`);
      return {t:cls, r:o.id};
    }
    const o = this.alloc({kind:'box', zone:'free', cls, value, inner});
    this.note(cls === 'Float' || cls === 'Double'
      ? TX`Autoboxing: ${q(cls)} üçün cache yoxdur, heap-də yeni object yaradıldı.`
      : TX`Autoboxing: ${q(label)} cache aralığından kənardır, heap-də yeni ${q(cls)} object-i yaradıldı.`);
    return {t:cls, r:o.id};
  }
  intern(s) {
    let o = this.pool[s];
    if (!o) {
      o = this.alloc({kind:'string', zone:'pool', value:s}); this.pool[s] = o;
      this.note(TX`${q('"' + s + '"')} String Pool-da yox idi, orada yeni object yaradıldı.`);
    } else {
      this.touch('o' + o.id);
      this.note(TX`${q('"' + s + '"')} artıq String Pool-dadır. Yeni object yaranmadı, mövcud olan istifadə olundu.`);
    }
    return {t:'String', r:o.id, c:true};
  }
  newString(s) { return {t:'String', r:this.alloc({kind:'string', zone:'free', value:s}).id}; }
  str(v) {
    if (v.r === undefined) return plainPrim(v.t, v.v);
    if (v.r === null) return 'null';
    const o = this.byId[v.r];
    if (o.kind === 'string') return o.value;
    if (o.kind === 'box') return plainPrim(o.inner, o.value);
    if (o.cls === 'ArrayList') return '[' + this.listItems(o).map(x => this.str(x)).join(', ') + ']';
    if (o.cls === 'LinkedList') return '[' + this.llNodes(o).map(n => this.str(this.fv(n, 'item'))).join(', ') + ']';
    if (o.cls === 'HashSet') return '[' + this.mapNodes(this.byId[this.fv(o, 'map').r]).map(n => this.str(this.fv(n, 'key'))).join(', ') + ']';
    if (o.cls === 'StringBuilder') return this.sbText(o);
    if (o.cls === 'HashMap') return '{' + this.mapNodes(o).map(n => this.str(this.fv(n, 'key')) + '=' + this.str(this.fv(n, 'value'))).join(', ') + '}';
    if (o.cls === 'HashMap.Node') return this.str(this.fv(o, 'key')) + '=' + this.str(this.fv(o, 'value'));
    if (o.kind === 'object') {
      const cl = this.prog.classes[o.cls];
      const ts = !o.statics && this.findM(o.cls, 'toString');
      if (ts) return this.str(this.invoke(ts, {t:o.cls, r:o.id}, [], this.line));
      if (o.isEnumConst) return this.str(this.fv(o, 'name'));
      if (cl && cl.isRecord) return `${o.cls}[${o.fields.map(f => f.name + '=' + this.str(f.val)).join(', ')}]`;
      if (this.isA(o.cls, 'Throwable')) {
        const pkg = o.cls === 'NoSuchElementException' ? 'java.util.' : o.cls in EXC ? 'java.lang.' : '';
        const msg = this.fv(o, 'message');
        return pkg + o.cls + (msg.r ? ': ' + this.byId[msg.r].value : '');
      }
    }
    return `${o.cls}@${o.id}`;
  }

  /* ----- expressions ----- */
  lookup(name) {
    const v = [...this.frame.vars].reverse().find(x => x.name === name);
    if (v) return {kind:'local', v};
    const self = this.frame.vars.find(x => x.name === 'this');
    if (self && self.val.r) {
      const fld = this.byId[self.val.r].fields.find(x => x.name === name);
      if (fld) return {kind:'field', f:fld, o:this.byId[self.val.r]};
    }
    for (let c = this.frame.cls; c; c = this.prog.classes[c] && this.prog.classes[c].sup) {
      const owner = this.statics[c];
      const fld = owner && owner.fields.find(x => x.name === name);
      if (fld) return {kind:'field', f:fld, o:owner};
    }
    return null;
  }
  eval(e) {
    switch (e.x) {
      case 'lit': {
        if (e.t === 'int' && e.v === 2147483648) throw compileErr(TX`2147483648 int üçün çox böyükdür. long üçün sonuna L yaz.`, e.line);
        return {t:e.t, v:e.v, c:true};
      }
      case 'str': return this.intern(e.v);
      case 'null': return {t:'null', r:null};
      case 'id': {
        const b = this.lookup(e.name);
        if (!b) {
          if (e.name === 'this') throw compileErr(TX`\`this\` yalnız object-in method-u daxilində var.`, e.line);
          throw compileErr(TX`${q(e.name)} adlı variable tapılmadı. Əvvəlcə onu declare et.`, e.line);
        }
        if (b.kind === 'local') {
          if (b.v.val === undefined) throw compileErr(TX`${q(e.name)} hələ value almayıb, onu oxumaq olmaz.`, e.line);
          return Object.assign({}, b.v.val);
        }
        return Object.assign({}, b.f.val);
      }
      case 'arrlit': throw compileErr(TX`Array syntax-ı {...} yalnız declaration zamanı işləyir. new int[]{1, 2} yaz.`, e.line);
      case 'assign': return this.evalAssign(e);
      case 'cond': return this.truth(this.eval(e.c)) ? this.eval(e.a) : this.eval(e.b);
      case 'bin': return this.evalBin(e);
      case 'un': {
        const v = this.unboxed(this.eval(e.e));
        if (e.op === '!') { if (v.t !== 'boolean') throw compileErr(TX`! yalnız boolean ilə işləyir.`, e.line); return {t:'boolean', v:!v.v, c:v.c}; }
        if (!isNumT(v.t)) throw compileErr(TX`${q(e.op)} yalnız number-lərlə işləyir.`, e.line);
        const t = RANK[v.t] < 3 ? 'int' : v.t;
        return {t, v:wrapNum(t, e.op === '-' ? -v.v : v.v), c:v.c};
      }
      case 'incdec': return this.evalIncDec(e);
      case 'cast': {
        const v = this.eval(e.e);
        if (isPrim(e.t)) {
          const u = this.unboxed(v);
          if (e.t === 'boolean' || u.t === 'boolean') { if (u.t !== e.t) throw compileErr(TX`boolean başqa type-a çevrilmir.`, e.line); return u; }
          let n = u.v;
          if (!['float','double'].includes(e.t) && ['float','double'].includes(u.t)) n = Number.isNaN(n) ? 0 : Math.trunc(n);
          return {t:e.t, v:wrapNum(e.t, n), c:v.c};
        }
        if (v.r && !this.isA(this.classOf(this.byId[v.r]), e.t) && (this.prog.classes[erase(e.t)] || e.t in BOX || e.t === 'String')) {
          throw new JavaError('runtime', TX`ClassCastException: ${q(this.classOf(this.byId[v.r]))} object-i ${q(e.t)} type-ına cast olunmur.`, e.line);
        }
        return this.coerce(v.r ? Object.assign({}, v, {t:this.classOf(this.byId[v.r])}) : v, e.t, e.line);
      }
      case 'instanceof': {
        const v = this.eval(e.e);
        if (v.r === undefined) throw compileErr(TX`${q('instanceof')} primitive ilə işləmir.`, e.line);
        return {t:'boolean', v:!!v.r && this.isA(this.classOf(this.byId[v.r]), e.t)};
      }
      case 'new': return this.evalNew(e);
      case 'newarr': {
        const dims = e.dims.map(d => {
          if (d === null) return null;
          const n = this.unboxed(this.eval(d));
          if (!['int','short','byte','char'].includes(n.t)) throw compileErr(TX`Array size-ı int olmalıdır.`, e.line);
          if (n.v < 0) throw new JavaError('runtime', TX`NegativeArraySizeException: array size-ı ${n.v} ola bilməz.`, e.line);
          return n.v;
        });
        if (dims[0] === null) throw compileErr(TX`Array-in size-ını yaz: new int[3].`, e.line);
        if (dims[0] > 64) throw compileErr(TX`Görüntü üçün array size-ı burada 64-lə məhdudlaşdırılıb.`, e.line);
        return this.makeArray(e.t, dims);
      }
      case 'index': {
        const {o, i} = this.arrayAt(e);
        return Object.assign({}, o.elems[i]);
      }
      case 'member': return this.evalMember(e);
      case 'call': return this.evalCall(e);
    }
    throw compileErr(TX`Bu ifadə dəstəklənmir.`, e.line);
  }
  makeArray(t, dims) {
    const elemT = t.slice(0, -2), n = dims[0], elems = [];
    for (let i = 0; i < n; i++) {
      if (dims.length > 1 && dims[1] !== null) elems.push(this.makeArray(elemT, dims.slice(1)));
      else elems.push(this.defaultVal(elemT));
    }
    const o = this.alloc({kind:'array', zone:'free', cls:t, elemT, elems});
    this.note(isPrim(elemT)
      ? TX`Array object-dir: ${q(t)} heap-də yaradıldı. Elementləri primitive olsa da, value-lar array-in içindədir, yəni heap-də.`
      : TX`${q(t)} heap-də yaradıldı. Elementlərdə object-lər yox, reference-lər saxlanır (hələlik ${q('null')}).`);
    return {t, r:o.id};
  }
  arrayFromLit(e, t) {
    if (!t || !t.endsWith('[]')) throw compileErr(TX`{...} syntax-ı yalnız array type-ı üçündür, burada isə type: ${q(t || '?')}.`, e.line);
    const elemT = t.slice(0, -2);
    const elems = e.items.map(it => it.x === 'arrlit' ? this.coerce(this.arrayFromLit(it, elemT), elemT, it.line) : this.coerce(this.eval(it), elemT, e.line));
    const o = this.alloc({kind:'array', zone:'free', cls:t, elemT, elems});
    this.note(isPrim(elemT)
      ? TX`Array object-dir: ${q(t)} heap-də yaradıldı. Elementləri primitive olsa da, value-lar array-in içindədir, yəni heap-də.`
      : TX`${q(t)} heap-də yaradıldı. Elementlərdə object-lər yox, reference-lər saxlanır.`);
    return {t, r:o.id};
  }
  arrayAt(e) {
    const a = this.eval(e.a);
    const iv = this.unboxed(this.eval(e.i));
    if (a.r === undefined || (a.r && this.byId[a.r].kind !== 'array')) throw compileErr(TX`[] yalnız array ilə işləyir.`, e.line);
    if (a.r === null) throw new JavaError('runtime', TX`NullPointerException: array variable-ı null-dur.`, e.line);
    const o = this.byId[a.r];
    if (iv.v < 0 || iv.v >= o.elems.length) throw Object.assign(new JavaError('runtime', TX`ArrayIndexOutOfBoundsException: ${iv.v} index-i yoxdur. Array-in length-i: ${o.elems.length}.`, e.line), {real:`Index ${iv.v} out of bounds for length ${o.elems.length}`});
    return {o, i:iv.v};
  }
  unboxed(v) {
    if (v.r === undefined) return v;
    if (v.r === null) throw new JavaError('runtime', TX`NullPointerException: ${v.t === 'null' ? 'null' : q(v.t) + TX` value-su null`} ilə operation aparmaq olmaz.`, this.line);
    const o = this.byId[v.r];
    if (o.kind !== 'box') throw compileErr(TX`${q(this.classOf(o))} ilə bu operation olmaz.`, this.line);
    this.note(TX`Unboxing: ${q(o.cls)} object-inin içindəki value çıxarıldı.`);
    return {t:o.inner, v:o.value};
  }
  evalBin(e) {
    const op = e.op;
    if (op === '&&') { const l = this.truth(this.eval(e.l)); return {t:'boolean', v:l && this.truth(this.eval(e.r))}; }
    if (op === '||') { const l = this.truth(this.eval(e.l)); return {t:'boolean', v:l || this.truth(this.eval(e.r))}; }
    const l = this.eval(e.l), r = this.eval(e.r);
    const isS = v => v.r !== undefined && v.r !== null && this.byId[v.r].kind === 'string' || v.t === 'String';
    if (op === '+' && (isS(l) || isS(r))) {
      const s = this.str(l) + this.str(r);
      if (l.c && r.c) { return this.intern(s); }
      this.note(TX`Concatenation runtime-da baş verir, ona görə ${q('"' + s + '"')} pool-a yox, heap-də yeni object-ə yazıldı.`);
      return this.newString(s);
    }
    if (op === '==' || op === '!=') {
      const lRef = l.r !== undefined, rRef = r.r !== undefined;
      let same;
      if (lRef && rRef) {
        same = l.r === r.r;
        this.note(same ? TX`${q('==')} reference-ləri müqayisə edir: hər ikisi eyni object-ə baxır.` : TX`${q('==')} reference-ləri müqayisə edir: bunlar fərqli object-lərə baxır${l.r && r.r ? TX`, value-ları eyni olsa belə` : ''}.`);
      } else {
        const a = this.unboxed(l), b = this.unboxed(r);
        if ((a.t === 'boolean') !== (b.t === 'boolean')) throw compileErr(TX`${q(a.t)} ilə ${q(b.t)} müqayisə olunmur.`, e.line);
        same = a.v === b.v;
        this.note(TX`${q('==')} burada value-ları müqayisə edir, çünki ən azı bir tərəf primitive-dir.`);
      }
      return {t:'boolean', v:op === '==' ? same : !same, c:l.c && r.c};
    }
    const a = this.unboxed(l), b = this.unboxed(r);
    if (!isNumT(a.t) || !isNumT(b.t)) throw compileErr(TX`${q(op)} operation-ı ${q(a.t)} və ${q(b.t)} üçün işləmir.`, e.line);
    if (['<','>','<=','>='].includes(op)) {
      const v = op === '<' ? a.v < b.v : op === '>' ? a.v > b.v : op === '<=' ? a.v <= b.v : a.v >= b.v;
      return {t:'boolean', v, c:l.c && r.c};
    }
    const t = ['double','float','long'].find(x => a.t === x || b.t === x) || 'int';
    let v;
    const isInt = t === 'int' || t === 'long';
    if (op === '/' || op === '%') {
      if (isInt && b.v === 0) throw Object.assign(new JavaError('runtime', TX`ArithmeticException: integer-i sıfıra bölmək olmaz.`, e.line), {real:'/ by zero'});
      v = op === '/' ? (isInt ? Math.trunc(a.v / b.v) : a.v / b.v) : a.v % b.v;
    } else v = op === '+' ? a.v + b.v : op === '-' ? a.v - b.v : a.v * b.v;
    if (t === 'int' && op === '*') v = Math.imul(a.v, b.v);
    return {t, v:wrapNum(t, v), c:l.c && r.c};
  }
  /* returns {read(), write(val)} for an assignable expression */
  place(e) {
    if (e.x === 'id') {
      const b = this.lookup(e.name);
      if (!b) throw compileErr(TX`${q(e.name)} adlı variable tapılmadı. Əvvəlcə onu declare et.`, e.line);
      if (b.kind === 'local') {
        const fi = this.frames.length - 1;
        return {t:b.v.t, label:e.name, inHeap:false, isFinal:b.v.isFinal && b.v.val !== undefined,
          read:() => { if (b.v.val === undefined) throw compileErr(TX`${q(e.name)} hələ value almayıb.`, e.line); return Object.assign({}, b.v.val); },
          old:b.v.val, write:val => { b.v.val = val; this.touch('v' + fi + ':' + e.name); }};
      }
      return this.fieldPlace(b.f, b.o, e.name);
    }
    if (e.x === 'member') {
      const owner = this.memberOwner(e);
      const f = owner.fields.find(x => x.name === e.name);
      if (!f) throw compileErr(TX`${q(owner.cls)} class-ında ${q(e.name)} field-i yoxdur.`, e.line);
      return this.fieldPlace(f, owner, e.name);
    }
    if (e.x === 'index') {
      const {o, i} = this.arrayAt(e);
      return {t:o.elemT, label:`[${i}]`, inHeap:true, arr:o,
        read:() => Object.assign({}, o.elems[i]), old:o.elems[i],
        write:val => { o.elems[i] = val; this.touch('o' + o.id); }};
    }
    throw compileErr(TX`Bu ifadəyə value yazmaq olmaz.`, e.line);
  }
  fieldPlace(f, o, label) {
    const decl = this.fieldDecl(o.cls, f.name);
    return {t:f.t, label, inHeap:true, field:true, isFinal:decl && decl.isFinal && !this.frame.isCtor,
      read:() => Object.assign({}, f.val), old:f.val,
      write:val => { f.val = val; this.touch('o' + o.id); }};
  }
  memberOwner(e) {
    if (e.o.x === 'id' && !this.lookup(e.o.name) && this.staticOwner(e.o.name, e.name)) return this.staticOwner(e.o.name, e.name);
    if (e.o.x === 'id' && e.o.name === 'this' && !this.lookup('this')) throw compileErr(TX`\`this\` yalnız object-in method-u daxilində var.`, e.line);
    const v = this.eval(e.o);
    if (v.r === undefined) throw compileErr(TX`${q(v.t)} primitive-dir, onun field-i olmur.`, e.line);
    if (v.r === null) throw new JavaError('runtime', TX`NullPointerException: variable null-dur, ${q(e.name)} field-inə çatmaq olmaz.`, e.line);
    const o = this.byId[v.r];
    if (o.kind !== 'object' || JDK[o.cls]) throw compileErr(TX`${q(this.classOf(o))} object-inin ${q(e.name)} field-i private-dır, ona birbaşa çatmaq olmaz.${o.cls === 'ArrayList' || o.cls === 'HashMap' ? TX` Method-dan istifadə et, məsələn ` + q('size()') + '.' : ''}`, e.line);
    return o;
  }
  evalAssign(e) {
    const pl = this.place(e.l);
    if (pl.isFinal) throw compileErr(TX`${q(pl.label)} final-dır, ona yenidən value vermək olmaz.`, e.line);
    let val;
    if (e.op === '=') {
      val = this.coerce(this.evalInit(e.r, pl.t), pl.t, e.line);
    } else {
      const cur = pl.read(), r = this.eval(e.r), op = e.op[0];
      const res = this.evalBinVals(op, cur, r, e.line);
      val = isPrim(pl.t) ? this.castPrim(res, pl.t) : this.coerce(res, pl.t, e.line);
    }
    this.describeWrite(pl, val);
    pl.write(val);
    return Object.assign({}, val);
  }
  evalBinVals(op, a, b, line) {
    return this.evalBin({op, l:{x:'__v', v:a}, r:{x:'__v', v:b}, line});
  }
  castPrim(v, t) {
    const u = this.unboxed(v);
    if (t === 'boolean' || u.t === 'boolean') return this.coerce(u, t);
    let n = u.v;
    if (!['float','double'].includes(t) && ['float','double'].includes(u.t)) n = Math.trunc(n);
    return {t, v:wrapNum(t, n)};
  }
  describeWrite(pl, val) {
    const where = pl.inHeap ? TX`heap-dəki object-in içində` : TX`stack-dəki slot-da`;
    if (val.r === undefined) {
      if (pl.old !== undefined && pl.old.v !== undefined) this.note(TX`${q(pl.label)}: ${where} köhnə value (${q(fmtPrim(pl.t, pl.old.v))}) yerinə ${q(fmtPrim(pl.t, val.v))} yazıldı.`);
      else this.note(TX`${q(pl.label)}: ${q(fmtPrim(pl.t, val.v))} ${where} saxlanır.`);
    } else if (val.r === null) this.note(TX`${q(pl.label)} artıq heç bir object-ə baxmır (${q('null')}).`);
    else this.note(TX`${q(pl.label)}: ${where} indi yeni reference var. Köhnə object-in özü dəyişmir.`);
  }
  evalIncDec(e) {
    const pl = this.place(e.e);
    if (pl.isFinal) throw compileErr(TX`${q(pl.label)} final-dır, onu dəyişmək olmaz.`, e.line);
    const old = pl.read();
    const res = this.evalBinVals(e.op[0], old, {t:'int', v:1}, e.line);
    const val = isPrim(pl.t) ? this.castPrim(res, pl.t) : this.coerce(this.castPrim(res, BOX[pl.t] || 'int'), pl.t, e.line);
    this.describeWrite(pl, val);
    pl.write(val);
    return e.prefix ? Object.assign({}, val) : old;
  }
  evalMember(e) {
    if (e.o.x === 'id' && !this.lookup(e.o.name)) {
      const owner = this.staticOwner(e.o.name, e.name);
      if (owner) return Object.assign({}, owner.fields.find(x => x.name === e.name).val);
      if (e.o.name === 'Integer' && e.name === 'MAX_VALUE') return {t:'int', v:2147483647, c:true};
      if (e.o.name === 'Integer' && e.name === 'MIN_VALUE') return {t:'int', v:-2147483648, c:true};
    }
    if (e.o.x === 'id' && e.o.name === 'this' && !this.lookup('this')) throw compileErr(TX`\`this\` yalnız object-in method-u daxilində var.`, e.line);
    const v = this.eval(e.o);
    if (v.r === undefined) throw compileErr(TX`${q(v.t)} primitive-dir, onun field-i olmur.`, e.line);
    if (v.r === null) throw new JavaError('runtime', TX`NullPointerException: variable null-dur, ${q(e.name)} field-inə çatmaq olmaz.`, e.line);
    const o = this.byId[v.r];
    if (o.kind === 'array' && e.name === 'length') return {t:'int', v:o.elems.length};
    if (o.kind === 'object' && !JDK[o.cls]) {
      const f = o.fields.find(x => x.name === e.name);
      if (f) return Object.assign({}, f.val);
    }
    throw compileErr(TX`${q(this.classOf(o))} type-ında ${q(e.name)} field-i yoxdur.`, e.line);
  }
  evalNew(e) {
    if (e.cls === 'String') {
      if (e.args.length === 0) { this.note(TX`\`new String()\` heap-də yeni boş object yaratdı.`); return this.newString(''); }
      const a = this.eval(e.args[0]);
      const s = this.str(a);
      this.note(TX`${q('new')} həmişə pool-dan kənarda, heap-də yeni object yaradır. Eyni mətn olsa belə bu ayrı object-dir.`);
      return this.newString(s);
    }
    if (e.cls in BOX) {
      if (e.args.length !== 1) throw compileErr(TX`new ${e.cls}(...) bir value almalıdır.`, e.line);
      const a = this.unboxed(this.eval(e.args[0]));
      const o = this.alloc({kind:'box', zone:'free', cls:e.cls, value:a.v, inner:BOX[e.cls]});
      this.note(TX`${q('new ' + e.cls)} cache-ə baxmır, həmişə yeni object yaradır. Bu yazılış deprecated-dir: ${q(e.cls + '.valueOf')} istifadə et.`);
      return {t:e.cls, r:o.id};
    }
    if (e.cls === 'Object') {
      const o = this.alloc({kind:'object', zone:'free', cls:'Object', fields:[]});
      this.note(TX`${q('new')} heap-də yeni object yaratdı.`);
      return {t:'Object', r:o.id};
    }
    if (e.cls === 'ArrayList') return this.newList(e);
    if (e.cls === 'HashMap') return this.newMap(e);
    if (e.cls === 'HashSet') return this.newSet(e);
    if (e.cls === 'LinkedList') return this.newLinked(e);
    if (e.cls === 'StringBuilder') return this.newSb(e);
    const cl = this.prog.classes[e.cls];
    if (!cl && e.cls in EXC) {
      const a = e.args.map(x => this.eval(x));
      const msg = a[0] ? this.coerce(a[0], 'String', e.line) : {t:'String', r:null};
      const o = this.alloc({kind:'object', zone:'free', cls:e.cls, fields:[{name:'message', t:'String', val:msg}]});
      this.note(TX`Exception adi object-dir: ${q(e.cls)} heap-də yaradıldı. ${q('throw')} olmadan heç nə baş vermir.`);
      return {t:e.cls, r:o.id};
    }
    if (!cl) throw compileErr(TX`${q(e.cls)} class-ı tanınmır. Əvvəlcə ${q('class ' + e.cls + ' { ... }')} yaz. Collection-lardan ${q('ArrayList')} və ${q('HashMap')} işləyir.`, e.line);
    if (cl.isAbstract) throw compileErr(TX`${q(e.cls)} abstract-dır, ondan object yaratmaq olmaz.`, e.line);
    if (cl.isEnum) throw compileErr(TX`Enum-dan ${q('new')} ilə object yaratmaq olmaz. Onun constant-larını istifadə et.`, e.line);
    const args = e.args.map(a => this.eval(a));
    const all = this.allFields(e.cls);
    const o = this.alloc({kind:'object', zone:'free', cls:e.cls, fields:all.map(f => ({name:f.name, t:f.t, from:f.owner !== e.cls ? f.owner : undefined, val:this.defaultVal(f.t)}))});
    this.note(TX`${q('new')} heap-də yeni ${q(e.cls)} object-i yaratdı. Field-ləri (primitive-lər də daxil) object-in içindədir, yəni heap-də, və initial value alıblar.`);
    if (all.some(f => f.owner !== e.cls)) this.note(TX`Inheritance ikinci object yaratmır: parent class-ın field-ləri eyni object-in içindədir.`);
    if (cl.isRecord) this.note(TX`Record-un field-ləri ${q('final')}-dır: object yaradıldıqdan sonra dəyişmir.`);
    const self = {t:e.cls, r:o.id};
    this.construct(e.cls, self, args, e.line);
    return self;
  }
  findM(cn, name) {
    const cl = this.prog.classes[cn];
    if (!cl) return null;
    const m = cl.methods[name];
    if (m && m.body) return m;
    return (cl.sup && this.findM(cl.sup, name)) || cl.ifaces.map(i => this.findM(i, name)).find(Boolean) || null;
  }
  fieldDecl(cn, name) {
    const cl = this.prog.classes[cn];
    if (!cl) return null;
    return cl.fields.find(f => f.name === name) || (cl.sup ? this.fieldDecl(cl.sup, name) : null);
  }
  allFields(cn) {
    if (cn in EXC) return [{name:'message', t:'String', owner:'Throwable'}];
    const cl = this.prog.classes[cn];
    if (!cl) return [];
    const own = cl.fields.filter(f => !f.isStatic).map(f => ({name:f.name, t:f.t, owner:cn}));
    return [...(cl.sup ? this.allFields(cl.sup) : []), ...own];
  }
  isA(dyn, target) {
    const t = erase(target);
    if (t === 'Object' || dyn === t || assignable(dyn, t)) return true;
    const cl = this.prog.classes[dyn];
    if (cl) return !!(cl.sup && this.isA(cl.sup, t)) || cl.ifaces.some(i => this.isA(i, t));
    if (dyn in EXC) return !!EXC[dyn] && this.isA(EXC[dyn], t);
    if (dyn in BOX && t === 'Number') return dyn !== 'Boolean' && dyn !== 'Character';
    return false;
  }
  runInits(cl, self) {
    const o = this.byId[self.r];
    for (const f of cl.fields) if (!f.isStatic && f.init) o.fields.find(x => x.name === f.name).val = this.coerce(this.evalInit(f.init, f.t), f.t, f.line);
  }
  construct(name, self, args, line) {
    if (!name) return;
    if (name in EXC) {
      if (args[0]) this.byId[self.r].fields.find(f => f.name === 'message').val = this.coerce(args[0], 'String', line);
      return;
    }
    const cl = this.prog.classes[name];
    if (!cl) throw compileErr(TX`${q(name)} class-ı tanınmır. Əvvəlcə ${q('class ' + name + ' { ... }')} yaz. Collection-lardan ${q('ArrayList')} və ${q('HashMap')} işləyir.`, line);
    const ctor = cl.ctors.find(c => c.params.length === args.length);
    if (ctor) { this.invoke(ctor, Object.assign({}, self, {t:name}), args, line, {ctor:true}); return; }
    if (cl.isRecord && args.length === cl.fields.length) {
      const o = this.byId[self.r];
      cl.fields.forEach((f, i) => { o.fields.find(x => x.name === f.name).val = this.coerce(args[i], f.t, line); });
      return;
    }
    if (cl.ctors.length || args.length || cl.isRecord) throw compileErr(TX`${q(name)} üçün ${args.length} parameter-li constructor yoxdur.`, line);
    // The implicit constructor: field initializers run in its own frame, where they can see this
    if (cl.fields.some(f => !f.isStatic && f.init)) {
      this.invoke({name, params:[], ret:null, cls:name, isStatic:false, line:cl.line, body:{s:'block', stmts:[], line:cl.line, endLine:cl.line}}, Object.assign({}, self, {t:name}), [], line, {ctor:true});
      return;
    }
    this.construct(cl.sup, self, [], line);
  }
  staticOwner(cn, name) {
    for (let c = cn; c; c = this.prog.classes[c] && this.prog.classes[c].sup) {
      const o = this.statics[c];
      if (o && o.fields.some(f => f.name === name)) return o;
    }
    return null;
  }
  ctorPrologue(m, self) {
    const cl = this.prog.classes[m.cls], b = m.body, first = b.stmts[0];
    const call = first && first.s === 'expr' && first.e.x === 'call' && !first.e.target && ['super', 'this'].includes(first.e.name) ? first.e : null;
    if (call) {
      this.line = first.line;
      const args = call.args.map(a => this.eval(a));
      if (call.name === 'this') { this.construct(m.cls, self, args, first.line); return Object.assign({}, b, {stmts:b.stmts.slice(1)}); }
      if (cl.sup) this.note(TX`${q('super(...)')} parent constructor-unu çağırır: stack-də yeni frame açılır, amma object eyni qalır.`);
      this.construct(cl.sup, self, args, first.line);
      this.runInits(cl, self);
      return Object.assign({}, b, {stmts:b.stmts.slice(1)});
    }
    if (cl.sup) this.construct(cl.sup, self, [], m.line);
    this.runInits(cl, self);
    return b;
  }
  invoke(m, self, args, line, opt = {}) {
    if (this.frames.length >= MAX_DEPTH) throw new JavaError('runtime', TX`StackOverflowError: method-lar bitmədən yeni frame-lər yaranır və stack dolur. Bu alət ${MAX_DEPTH} frame-də dayanır, real JVM-də limit adətən minlərlədir.`, line);
    if (m.params.length !== args.length) throw compileErr(TX`${q(m.name)} ${m.params.length} parameter gözləyir, ${args.length} verildi.`, line);
    const vals = m.params.map((p, i) => this.coerce(args[i], p.t, line));
    const label = (m.cls ? m.cls + '.' : '') + m.name + '()';
    const f = {name:label, vars:[], cls:m.cls, isCtor:!!opt.ctor};
    if (self) f.vars.push({name:'this', t:self.t, val:{t:self.t, r:self.r}});
    m.params.forEach((p, i) => f.vars.push({name:p.name, t:p.t, val:vals[i]}));
    this.frames.push(f);
    const fi = this.frames.length - 1;
    f.vars.forEach(v => this.touch('v' + fi + ':' + v.name));
    this.note(TX`Method çağırıldı: stack-in üstünə yeni frame əlavə olundu.${m.params.length ? TX` Parameter-lər argument-lərin kopyasıdır.` : ''}`);
    this.step(m.line);
    let ret = null;
    try { this.execBlock(opt.ctor ? this.ctorPrologue(m, self) : m.body); }
    catch (e) { if (e instanceof Signal && e.kind === 'return') ret = e.val; else throw e; }
    this.line = line;
    if (m.ret && m.ret !== 'void') {
      if (!ret) throw compileErr(TX`${q(m.name)} method-u value qaytarmalıdır.`, m.line);
      ret = this.coerce(ret, m.ret, m.line);
    } else if (ret) throw compileErr(TX`${q(m.name)} void-dur, value qaytara bilməz.`, m.line);
    this.frames.pop();
    this.note(TX`${q(label)} bitdi: onun frame-i bütün local variable-larla birlikdə stack-dən silindi.${ret ? TX` Nəticə çağıran method-a qaytarıldı.` : ''}`);
    this.step(line);
    return ret || {t:'void', v:null};
  }
  evalCall(e) {
    // System.out.println
    if (e.target && e.target.x === 'member' && e.target.name === 'out' && e.target.o.x === 'id' && e.target.o.name === 'System') {
      if (!['println','print'].includes(e.name)) throw compileErr(TX`System.out.${e.name} dəstəklənmir: println və ya print yaz.`, e.line);
      const s = e.args.length ? this.str(this.eval(e.args[0])) : '';
      this.out.push(s + (e.name === 'println' ? '\n' : ''));
      return {t:'void', v:null};
    }
    if (e.target && e.target.x === 'id' && e.target.name === 'super') {
      const th = this.frame.vars.find(v => v.name === 'this'), cl = this.prog.classes[this.frame.cls];
      const m = th && cl && cl.sup && this.findM(cl.sup, e.name);
      if (!m) throw compileErr(TX`${q(e.name)} adlı method tapılmadı.`, e.line);
      return this.invoke(m, th.val, e.args.map(a => this.eval(a)), e.line);
    }
    // bare call
    if (!e.target) {
      const here = this.frame.vars.find(v => v.name === 'this');
      const dyn = here && here.val.r ? this.byId[here.val.r].cls : this.frame.cls;
      let m = dyn && this.findM(dyn, e.name), self = null;
      if (m && !m.isStatic) {
        const th = this.frame.vars.find(v => v.name === 'this');
        if (!th) throw compileErr(TX`${q(e.name)} static deyil, onu object olmadan çağırmaq olmaz.`, e.line);
        self = th.val;
      }
      if (!m) m = this.prog.methods[e.name];
      if (!m) throw compileErr(TX`${q(e.name)} adlı method tapılmadı.`, e.line);
      return this.invoke(m, self, e.args.map(a => this.eval(a)), e.line);
    }
    // static call on a known class name
    if (e.target.x === 'id' && !this.lookup(e.target.name)) {
      const cn = e.target.name;
      if (cn in BOX && e.name === 'valueOf') {
        const a = this.unboxed(this.eval(e.args[0]));
        return this.coerce(a, cn, e.line);
      }
      if (cn === 'Integer' && e.name === 'parseInt') {
        const s = this.str(this.eval(e.args[0]));
        if (!/^[+-]?\d+$/.test(s) || Math.abs(Number(s)) > 2147483648 || Number(s) === 2147483648) {
          const err = new JavaError('runtime', TX`NumberFormatException: ${q(s)} number-ə çevrilmir.`, e.line);
          err.real = `For input string: "${s}"`;
          throw err;
        }
        return {t:'int', v:Number(s)};
      }
      if (cn === 'String' && e.name === 'valueOf') return this.newString(this.str(this.eval(e.args[0])));
      if (this.prog.classes[cn]) {
        const m = this.findM(cn, e.name);
        if (!m) throw compileErr(TX`${q(cn)} class-ında ${q(e.name)} method-u yoxdur.`, e.line);
        if (!m.isStatic) throw compileErr(TX`${q(e.name)} static deyil, onu object üzərindən çağır.`, e.line);
        return this.invoke(m, null, e.args.map(a => this.eval(a)), e.line);
      }
      if (cn === 'Math' && ['max','min','abs'].includes(e.name)) {
        const a = e.args.map(x => this.unboxed(this.eval(x)));
        const t = a.reduce((m, x) => RANK[x.t] > RANK[m] ? x.t : m, 'int');
        const v = Math[e.name](...a.map(x => x.v));
        return {t, v};
      }
      throw compileErr(TX`${q(cn)} adlı variable və ya class tapılmadı.`, e.line);
    }
    // instance call
    const v = this.eval(e.target);
    if (v.r === undefined) throw compileErr(TX`${q(v.t)} primitive-dir, onun method-u olmur.`, e.line);
    if (v.r === null) throw new JavaError('runtime', TX`NullPointerException: variable null-dur, ${q(e.name + '()')} çağırmaq olmaz.`, e.line);
    const o = this.byId[v.r];
    const args = e.args.map(a => this.eval(a));
    if (o.cls === 'ArrayList') return this.listMethod(o, v, e, args);
    if (o.cls === 'HashMap') return this.mapMethod(o, v, e, args);
    if (o.cls === 'HashMap.Node') return this.entryMethod(o, v, e, args);
    if (o.cls === 'HashSet') return this.setMethod(o, v, e, args);
    if (o.cls === 'LinkedList') return this.linkedMethod(o, v, e, args);
    if (o.cls === 'StringBuilder') return this.sbMethod(o, v, e, args);
    if (o.kind === 'object') {
      const um = this.findM(o.cls, e.name);
      if (um) {
        if (v.t && erase(v.t) !== o.cls && this.prog.classes[erase(v.t)] && !this.prog.classes[erase(v.t)].methods[e.name] === false) this.note(TX`Variable-ın type-ı ${q(erase(v.t))}, amma object-in özü ${q(o.cls)}-dir. Java hansı method-un işləyəcəyini object-ə görə seçir.`);
        return this.invoke(um, um.isStatic ? null : {t:o.cls, r:o.id}, args, e.line);
      }
      const cl = this.prog.classes[o.cls];
      if (cl && cl.isRecord) {
        const f = o.fields.find(x => x.name === e.name);
        if (f && !args.length) return Object.assign({}, f.val);
        if (e.name === 'equals' && args.length === 1) {
          this.note(TX`Record ${q('equals')} method-unu özü yaradır: field-ləri müqayisə edir.`);
          return {t:'boolean', v:!!args[0].r && this.sameContent({r:o.id}, args[0])};
        }
        if (e.name === 'toString' && !args.length) return this.newString(this.str(v));
      }
      if (cl && o.isEnumConst) {
        if (e.name === 'name' || e.name === 'toString') return Object.assign({}, this.fv(o, 'name'));
        if (e.name === 'ordinal') return Object.assign({}, this.fv(o, 'ordinal'));
      }
      if (this.isA(o.cls, 'Throwable')) {
        if (e.name === 'getMessage') return Object.assign({}, this.fv(o, 'message'));
        if (e.name === 'toString') return this.newString(this.str(v));
        if (e.name === 'printStackTrace') { this.out.push(this.str(v) + '\n'); return {t:'void', v:null}; }
      }
    }
    if (e.name === 'hashCode' && args.length === 0) return {t:'int', v:this.hashOf(v)};
    if (e.name === 'equals' && args.length === 1) {
      const a = args[0], ao = a.r ? this.byId[a.r] : null;
      if (a.r === undefined) { // primitive argument gets boxed
        const b = this.box(UNBOX_TO[a.t], a.v);
        return this.evalEq(o, this.byId[b.r], e);
      }
      return this.evalEq(o, ao, e);
    }
    if (o.kind === 'string') return this.stringMethod(o, e, args);
    if (o.kind === 'box') {
      const m = /^(byte|short|int|long|float|double|boolean|char)Value$/.exec(e.name);
      if (m) return this.castPrim({t:o.inner, v:o.value}, m[1]);
      if (e.name === 'toString') return this.newString(plainPrim(o.inner, o.value));
    }
    throw compileErr(TX`${q(this.classOf(o))} üçün ${q(e.name + '()')} method-u hələ dəstəklənmir.`, e.line);
  }
  /* ----- java.util.ArrayList: same growth rules as the JDK source ----- */
  fv(o, name) { return o.fields.find(f => f.name === name).val; }
  setF(o, name, val) { o.fields.find(f => f.name === name).val = val; this.touch('o' + o.id); }
  emptyArray(key) {
    this.shared = this.shared || {};
    if (!this.shared[key]) this.shared[key] = this.alloc({kind:'array', zone:'shared', cls:'Object[]', elemT:'Object', elems:[]});
    return this.shared[key];
  }
  newList(e) {
    const args = e.args.map(a => this.eval(a));
    let arr, isDefault = false;
    if (args.length === 0) {
      arr = this.emptyArray('default'); isDefault = true;
      this.note(TX`${q('new ArrayList')} heap-də object yaratdı, amma hələ öz array-i yoxdur: ${q('elementData')} shared boş array-ə baxır. 10 yerlik array ilk ${q('add')}-də yaranacaq.`);
    } else {
      const n = args[0].r === undefined ? args[0].v : null;
      if (args.length > 1 || n === null || args[0].t === 'boolean') throw compileErr(TX`Burada yalnız ${q('new ArrayList<>()')} və ${q(TX`new ArrayList<>(capacity)`)} dəstəklənir.`, e.line);
      if (n < 0) throw new JavaError('runtime', TX`IllegalArgumentException: capacity ${n} ola bilməz.`, e.line);
      if (n === 0) arr = this.emptyArray('empty');
      else arr = this.alloc({kind:'array', zone:'free', cls:'Object[]', elemT:'Object', elems:Array.from({length:n}, () => ({t:'Object', r:null}))});
      this.note(TX`${q('new ArrayList')} heap-də object və ${n} yerlik ${q('Object[]')} array-i yaratdı. ${q('size')} hələ 0-dır: capacity və size fərqli şeylərdir.`);
    }
    const o = this.alloc({kind:'object', zone:'free', cls:'ArrayList', defaultEmpty:isDefault, fields:[
      {name:'size', t:'int', val:{t:'int', v:0}},
      {name:'elementData', t:'Object[]', val:{t:'Object[]', r:arr.id}},
    ]});
    return {t:e.gt, r:o.id};
  }
  listArr(o) { return this.byId[this.fv(o, 'elementData').r]; }
  listItems(o) { return this.listArr(o).elems.slice(0, this.fv(o, 'size').v); }
  listGrow(o) {
    const old = this.listArr(o), cap = old.elems.length, size = this.fv(o, 'size').v;
    const isDef = o.defaultEmpty && cap === 0;
    const next = isDef ? Math.max(10, size + 1) : cap + Math.max(1, cap >> 1);
    const elems = Array.from({length:next}, (_, i) => i < cap ? old.elems[i] : {t:'Object', r:null});
    const arr = this.alloc({kind:'array', zone:'free', cls:'Object[]', elemT:'Object', elems});
    this.setF(o, 'elementData', {t:'Object[]', r:arr.id});
    o.defaultEmpty = false;
    if (cap === 0) this.note(TX`Array boş idi: heap-də ${next} yerlik yeni ${q('Object[]')} yaradıldı.`);
    else this.note(TX`Array doldu (${cap} yer). Array-in size-ı dəyişə bilmir, ona görə ${next} yerlik yeni array yaradıldı və elementlər ora köçürüldü.`);
  }
  listIndex(o, i, e, forAdd) {
    const size = this.fv(o, 'size').v;
    if (i < 0 || (forAdd ? i > size : i >= size)) throw Object.assign(new JavaError('runtime', TX`IndexOutOfBoundsException: ${i} index-i yoxdur. ${q('size')}: ${size}.`, e.line), {real:`Index ${i} out of bounds for length ${size}`});
  }
  sameContent(a, b) {
    if (a.r === null || b.r === null || a.r === undefined || b.r === undefined) return a.r === b.r;
    if (a.r === b.r) return true;
    const x = this.byId[a.r], y = this.byId[b.r];
    if (x.kind === 'string' && y.kind === 'string') return x.value === y.value;
    if (x.kind === 'box' && y.kind === 'box') return x.cls === y.cls && Object.is(x.value, y.value);
    const eq = x.kind === 'object' && this.findM(x.cls, 'equals');
    if (eq) return this.invoke(eq, {t:x.cls, r:x.id}, [{t:'Object', r:y.id}], this.line).v;
    const cl = x.kind === 'object' && this.prog.classes[x.cls];
    if (cl && cl.isRecord && x.cls === y.cls) return x.fields.every((f, i) => {
      const g = y.fields[i].val;
      return f.val.r === undefined ? Object.is(f.val.v, g.v) : this.sameContent(f.val, g);
    });
    return false;
  }
  listMethod(o, v, e, args) {
    const T = genArgs(v.t)[0] || 'Object', n = e.name, size = this.fv(o, 'size').v;
    const need = k => { if (args.length !== k) throw compileErr(TX`${q(n)} ${k} argument gözləyir, ${args.length} verildi.`, e.line); };
    const typed = el => Object.assign({}, el, {t:T});
    const store = x => { const c = this.coerce(x, T, e.line); return {t:'Object', r:c.r}; };
    const setSize = k => this.setF(o, 'size', {t:'int', v:k});
    switch (n) {
      case 'add': {
        const atIndex = args.length === 2;
        if (!atIndex) need(1);
        const i = atIndex ? this.unboxed(args[0]).v : size;
        if (atIndex) this.listIndex(o, i, e, true);
        const el = store(args[atIndex ? 1 : 0]);
        if (size === this.listArr(o).elems.length) this.listGrow(o);
        const arr = this.listArr(o);
        if (atIndex) { arr.elems.splice(i, 0, el); arr.elems.pop(); }
        else arr.elems[i] = el;
        this.touch('o' + arr.id);
        setSize(size + 1);
        const moved = atIndex && i < size ? TX` Sağdakı ${size - i} element bir cell sürüşdürüldü.` : '';
        this.note(TX`Element ${q('elementData[' + i + ']')} cell-inə yazıldı: array-də object-in özü yox, reference saxlanır.${moved} ${q('size')}: ${size + 1}.`);
        return {t:'boolean', v:true};
      }
      case 'get': {
        need(1); const i = this.unboxed(args[0]).v; this.listIndex(o, i, e);
        this.note(TX`${q('get(' + i + ')')} ${q('elementData[' + i + ']')} cell-indəki reference-i qaytardı. Yeni object yaranmadı.`);
        return typed(this.listArr(o).elems[i]);
      }
      case 'set': {
        need(2); const i = this.unboxed(args[0]).v; this.listIndex(o, i, e);
        const arr = this.listArr(o), old = arr.elems[i];
        arr.elems[i] = store(args[1]); this.touch('o' + arr.id);
        this.note(TX`${q('elementData[' + i + ']')} cell-inə yeni reference yazıldı.`);
        return typed(old);
      }
      case 'remove': {
        need(1);
        const arr = this.listArr(o), a = args[0];
        let i;
        if (a.r === undefined) {
          i = this.unboxed(a).v; this.listIndex(o, i, e);
          this.note(TX`Argument primitive ${q(a.t)} olduğu üçün ${q('remove(int index)')} çağırıldı: value yox, ${i} index-i silinir.`);
        } else {
          i = this.listItems(o).findIndex(x => this.sameContent(x, a));
          this.note(TX`Argument object olduğu üçün ${q('remove(Object)')} çağırıldı: value-ya görə axtarılır.`);
          if (i < 0) return {t:'boolean', v:false};
        }
        const old = arr.elems[i];
        arr.elems.splice(i, 1); arr.elems.push({t:'Object', r:null});
        this.touch('o' + arr.id); setSize(size - 1);
        this.note(TX`Sağdakı elementlər sola sürüşdü. Array kiçilmir: capacity ${arr.elems.length} olaraq qalır.`);
        return a.r === undefined ? typed(old) : {t:'boolean', v:true};
      }
      case 'size': need(0); return {t:'int', v:size};
      case 'isEmpty': need(0); return {t:'boolean', v:size === 0};
      case 'contains': case 'indexOf': {
        need(1);
        const a = args[0].r === undefined ? this.coerce(args[0], 'Object', e.line) : args[0];
        const i = this.listItems(o).findIndex(x => this.sameContent(x, a));
        return n === 'contains' ? {t:'boolean', v:i >= 0} : {t:'int', v:i};
      }
      case 'clear': {
        need(0); const arr = this.listArr(o);
        arr.elems = arr.elems.map(() => ({t:'Object', r:null}));
        this.touch('o' + arr.id); setSize(0);
        this.note(TX`Cell-lər ${q('null')} oldu, ${q('size')} 0-a düşdü. Array-in özü silinmir.`);
        return {t:'void', v:null};
      }
    }
    throw compileErr(TX`ArrayList üçün ${q(n + '()')} hələ dəstəklənmir. İşləyənlər: add, get, set, remove, size, isEmpty, contains, indexOf, clear.`, e.line);
  }

  /* ----- java.lang.StringBuilder: same capacity rules as the JDK source ----- */
  newSb(e) {
    const args = e.args.map(a => this.eval(a));
    let cap = 16, text = '';
    if (args.length) {
      if (args[0].r === undefined && args[0].t !== 'boolean' && args[0].t !== 'char') {
        cap = args[0].v;
        if (cap < 0) throw new JavaError('runtime', TX`NegativeArraySizeException: array size-ı ${cap} ola bilməz.`, e.line);
      } else { text = this.str(args[0]); cap = text.length + 16; }
    }
    const cells = Array.from({length:cap}, (_, i) => ({t:'char', v:i < text.length ? text.charCodeAt(i) : 0}));
    const arr = this.alloc({kind:'array', zone:'free', cls:'byte[]', elemT:'char', elems:cells, sb:true});
    const o = this.alloc({kind:'object', zone:'free', cls:'StringBuilder', fields:[
      {name:'count', t:'int', val:{t:'int', v:text.length}},
      {name:'value', t:'byte[]', val:{t:'byte[]', r:arr.id}},
    ]});
    this.note(TX`${q('StringBuilder')} heap-də object və ${cap} yerlik array yaratdı. String-dən fərqli olaraq bu array dəyişə bilir. Real array ${q('byte[]')}-dir, burada oxunaqlı olsun deyə character-lər göstərilir.`);
    return {t:'StringBuilder', r:o.id};
  }
  sbArr(o) { return this.byId[this.fv(o, 'value').r]; }
  sbText(o) { return String.fromCharCode(...this.sbArr(o).elems.slice(0, this.fv(o, 'count').v).map(c => c.v)); }
  sbWrite(o, text) {
    let arr = this.sbArr(o);
    const cap = arr.elems.length, need = text.length;
    if (need > cap) {
      const next = cap + Math.max(need - cap, cap + 2);
      arr = this.alloc({kind:'array', zone:'free', cls:'byte[]', elemT:'char', sb:true, elems:Array.from({length:next}, () => ({t:'char', v:0}))});
      this.setF(o, 'value', {t:'byte[]', r:arr.id});
      this.note(TX`Array doldu (${cap} yer). ${next} yerlik yeni array yaradıldı və character-lər ora köçürüldü. Formula: köhnə capacity × 2 + 2.`);
    }
    arr.elems = arr.elems.map((_, i) => ({t:'char', v:i < text.length ? text.charCodeAt(i) : 0}));
    this.touch('o' + arr.id);
    this.setF(o, 'count', {t:'int', v:text.length});
  }
  sbMethod(o, v, e, args) {
    const n = e.name, text = this.sbText(o), self = {t:v.t, r:o.id};
    const idx = (i, max) => {
      if (i < 0 || i >= max) throw Object.assign(new JavaError('runtime', TX`StringIndexOutOfBoundsException: ${i} index-i yoxdur. String-in length-i: ${text.length}.`, e.line), {real:`index ${i},length ${text.length}`});
    };
    switch (n) {
      case 'append': {
        const add = this.str(args[0]);
        this.sbWrite(o, text + add);
        this.note(TX`Yeni String yaranmadı: character-lər eyni array-ə yazıldı və eyni object qaytarıldı.`);
        return self;
      }
      case 'insert': {
        const i = this.unboxed(args[0]).v;
        if (i < 0 || i > text.length) throw Object.assign(new JavaError('runtime', TX`StringIndexOutOfBoundsException: ${i} index-i yoxdur. String-in length-i: ${text.length}.`, e.line), {real:`offset ${i}, length ${text.length}`});
        this.sbWrite(o, text.slice(0, i) + this.str(args[1]) + text.slice(i));
        return self;
      }
      case 'reverse': this.sbWrite(o, [...text].reverse().join('')); return self;
      case 'deleteCharAt': { const i = this.unboxed(args[0]).v; idx(i, text.length); this.sbWrite(o, text.slice(0, i) + text.slice(i + 1)); return self; }
      case 'setCharAt': { const i = this.unboxed(args[0]).v; idx(i, text.length); this.sbWrite(o, text.slice(0, i) + String.fromCharCode(this.unboxed(args[1]).v) + text.slice(i + 1)); return {t:'void', v:null}; }
      case 'charAt': { const i = this.unboxed(args[0]).v; idx(i, text.length); return {t:'char', v:text.charCodeAt(i)}; }
      case 'length': return {t:'int', v:text.length};
      case 'isEmpty': return {t:'boolean', v:!text.length};
      case 'capacity': return {t:'int', v:this.sbArr(o).elems.length};
      case 'toString':
        this.note(TX`${q('toString()')} array-dəki character-ləri kopyalayır: heap-də yeni String yaranır, pool-a düşmür.`);
        return this.newString(text);
    }
    throw compileErr(TX`StringBuilder üçün ${q(n + '()')} hələ dəstəklənmir. İşləyənlər: append, insert, reverse, deleteCharAt, setCharAt, charAt, length, isEmpty, capacity, toString.`, e.line);
  }

  /* ----- java.util.HashSet: a HashMap inside, as in the JDK source ----- */
  newSet(e) {
    const mv = this.newMap({args:e.args, gt:'HashMap', line:e.line});
    this.notes = [];
    const o = this.alloc({kind:'object', zone:'free', cls:'HashSet', fields:[{name:'map', t:'HashMap', val:{t:'HashMap', r:mv.r}}]});
    this.note(TX`${q('HashSet')} daxildə ${q('HashMap')} işlədir: elementlər key olur, value isə hamısı üçün eyni ${q('PRESENT')} object-idir.`);
    return {t:e.gt, r:o.id};
  }
  setMethod(o, v, e, args) {
    const T0 = genArgs(v.t)[0] || 'Object', n = e.name, mo = this.byId[this.fv(o, 'map').r], mv = {t:`HashMap<${T0},Object>`, r:mo.id};
    const call = (name, a) => this.mapMethod(mo, mv, {name, line:e.line}, a);
    switch (n) {
      case 'add': {
        if (!this.present) this.present = this.alloc({kind:'object', zone:'shared', cls:'Object', label:'PRESENT', fields:[]});
        const added = call('put', [args[0], {t:'Object', r:this.present.id}]).r === null;
        if (!added) this.note(TX`Bu element artıq var: set dəyişmədi, ${q('add')} ${q('false')} qaytardı.`);
        return {t:'boolean', v:added};
      }
      case 'contains': return call('containsKey', args);
      case 'remove': return {t:'boolean', v:call('remove', args).r !== null};
      case 'size': case 'isEmpty': case 'clear': return call(n, args);
    }
    throw compileErr(TX`HashSet üçün ${q(n + '()')} hələ dəstəklənmir. İşləyənlər: add, contains, remove, size, isEmpty, clear.`, e.line);
  }

  /* ----- java.util.LinkedList: a doubly linked list, as in the JDK source ----- */
  newLinked(e) {
    if (e.args.length) throw compileErr(TX`Burada yalnız ${q('new LinkedList<>()')} dəstəklənir.`, e.line);
    const o = this.alloc({kind:'object', zone:'free', cls:'LinkedList', fields:[
      {name:'size', t:'int', val:{t:'int', v:0}},
      {name:'first', t:'Node', val:{t:'Node', r:null}},
      {name:'last', t:'Node', val:{t:'Node', r:null}},
    ]});
    this.note(TX`${q('LinkedList')} heap-də object yaratdı. ${q('ArrayList')}-dən fərqli olaraq array-i yoxdur: hər element ayrıca ${q('Node')} object-ində olacaq.`);
    return {t:e.gt, r:o.id};
  }
  llNodes(o) {
    const out = [];
    for (let r = this.fv(o, 'first').r; r; r = this.fv(this.byId[r], 'next').r) out.push(this.byId[r]);
    return out;
  }
  llLink(o, item, prevId, nextId) {
    const n = this.alloc({kind:'object', zone:'free', cls:'LinkedList.Node', fields:[
      {name:'item', t:'Object', val:{t:'Object', r:item.r}},
      {name:'next', t:'Node', val:{t:'Node', r:nextId}},
      {name:'prev', t:'Node', val:{t:'Node', r:prevId}},
    ]});
    const ref = {t:'Node', r:n.id};
    if (prevId) this.setF(this.byId[prevId], 'next', ref); else this.setF(o, 'first', ref);
    if (nextId) this.setF(this.byId[nextId], 'prev', ref); else this.setF(o, 'last', ref);
    this.setF(o, 'size', {t:'int', v:this.fv(o, 'size').v + 1});
    this.note(TX`Heap-də yeni ${q('Node')} yaradıldı. Heç bir element sürüşmədi: yalnız qonşu Node-ların ${q('next')} və ${q('prev')} reference-ləri dəyişdi.`);
  }
  llUnlink(o, n) {
    const p = this.fv(n, 'prev').r, x = this.fv(n, 'next').r, item = this.fv(n, 'item');
    if (p) this.setF(this.byId[p], 'next', {t:'Node', r:x}); else this.setF(o, 'first', {t:'Node', r:x});
    if (x) this.setF(this.byId[x], 'prev', {t:'Node', r:p}); else this.setF(o, 'last', {t:'Node', r:p});
    n.fields.forEach(f => { f.val = {t:f.t, r:null}; });
    this.setF(o, 'size', {t:'int', v:this.fv(o, 'size').v - 1});
    this.note(TX`${q('Node')} chain-dən çıxarıldı: qonşular bir-birinə bağlandı.`);
    return item;
  }
  llAt(o, i) {
    const size = this.fv(o, 'size').v, nodes = this.llNodes(o);
    const hops = i < (size >> 1) ? i : size - 1 - i;
    this.note(TX`${i} index-inə çatmaq üçün ${hops} addım Node-dan Node-a keçildi. Array-dən fərqli olaraq birbaşa keçid yoxdur.`);
    return nodes[i];
  }
  linkedMethod(o, v, e, args) {
    const T0 = genArgs(v.t)[0] || 'Object', n = e.name, size = this.fv(o, 'size').v;
    const typed = el => Object.assign({}, el, {t:T0});
    const store = x => ({t:'Object', r:this.coerce(x, T0, e.line).r});
    const first = () => this.fv(o, 'first').r, last = () => this.fv(o, 'last').r;
    const empty = () => { throw Object.assign(new JavaError('runtime', TX`NoSuchElementException: list boşdur.`, e.line), {real:null}); };
    const check = (i, max) => {
      if (i < 0 || i >= max) throw Object.assign(new JavaError('runtime', TX`IndexOutOfBoundsException: ${i} index-i yoxdur. ${q('size')}: ${size}.`, e.line), {real:`Index: ${i}, Size: ${size}`});
    };
    switch (n) {
      case 'add':
        if (args.length === 2) {
          const i = this.unboxed(args[0]).v; check(i, size + 1);
          const item = store(args[1]);
          if (i === size) this.llLink(o, item, last(), null);
          else { const at = this.llAt(o, i); this.llLink(o, item, this.fv(at, 'prev').r, at.id); }
          return {t:'void', v:null};
        }
        this.llLink(o, store(args[0]), last(), null); return {t:'boolean', v:true};
      case 'addLast': case 'offer': case 'offerLast': this.llLink(o, store(args[0]), last(), null); return n === 'addLast' ? {t:'void', v:null} : {t:'boolean', v:true};
      case 'addFirst': case 'push': this.llLink(o, store(args[0]), null, first()); return {t:'void', v:null};
      case 'offerFirst': this.llLink(o, store(args[0]), null, first()); return {t:'boolean', v:true};
      case 'get': { const i = this.unboxed(args[0]).v; check(i, size); return typed(this.fv(this.llAt(o, i), 'item')); }
      case 'set': { const i = this.unboxed(args[0]).v; check(i, size); const at = this.llAt(o, i), old = this.fv(at, 'item'); this.setF(at, 'item', store(args[1])); return typed(old); }
      case 'getFirst': case 'element': if (!size) empty(); return typed(this.fv(this.byId[first()], 'item'));
      case 'getLast': if (!size) empty(); return typed(this.fv(this.byId[last()], 'item'));
      case 'peek': case 'peekFirst': return size ? typed(this.fv(this.byId[first()], 'item')) : {t:T0, r:null};
      case 'peekLast': return size ? typed(this.fv(this.byId[last()], 'item')) : {t:T0, r:null};
      case 'poll': case 'pollFirst': return size ? typed(this.llUnlink(o, this.byId[first()])) : {t:T0, r:null};
      case 'pollLast': return size ? typed(this.llUnlink(o, this.byId[last()])) : {t:T0, r:null};
      case 'removeFirst': case 'pop': if (!size) empty(); return typed(this.llUnlink(o, this.byId[first()]));
      case 'removeLast': if (!size) empty(); return typed(this.llUnlink(o, this.byId[last()]));
      case 'remove': {
        if (!args.length) { if (!size) empty(); return typed(this.llUnlink(o, this.byId[first()])); }
        const a = args[0];
        if (a.r === undefined) { const i = this.unboxed(a).v; check(i, size); return typed(this.llUnlink(o, this.llAt(o, i))); }
        const hit = this.llNodes(o).find(x => this.sameContent(this.fv(x, 'item'), a));
        if (!hit) return {t:'boolean', v:false};
        this.llUnlink(o, hit); return {t:'boolean', v:true};
      }
      case 'size': return {t:'int', v:size};
      case 'isEmpty': return {t:'boolean', v:size === 0};
      case 'contains': case 'indexOf': {
        const a = args[0].r === undefined ? this.coerce(args[0], 'Object', e.line) : args[0];
        const i = this.llNodes(o).findIndex(x => this.sameContent(this.fv(x, 'item'), a));
        return n === 'contains' ? {t:'boolean', v:i >= 0} : {t:'int', v:i};
      }
      case 'clear':
        this.llNodes(o).forEach(x => x.fields.forEach(f => { f.val = {t:f.t, r:null}; }));
        this.setF(o, 'first', {t:'Node', r:null}); this.setF(o, 'last', {t:'Node', r:null}); this.setF(o, 'size', {t:'int', v:0});
        return {t:'void', v:null};
    }
    throw compileErr(TX`LinkedList üçün ${q(n + '()')} hələ dəstəklənmir. İşləyənlər: add, addFirst, addLast, get, set, getFirst, getLast, remove, removeFirst, removeLast, push, pop, peek, poll, offer, size, isEmpty, contains, indexOf, clear.`, e.line);
  }

  /* ----- java.util.HashMap: same hash, index and resize rules as the JDK source ----- */
  newMap(e) {
    const args = e.args.map(a => this.eval(a));
    let threshold = 0;
    if (args.length) {
      const n = args[0].r === undefined ? args[0].v : null;
      if (args.length > 1 || n === null || args[0].t === 'boolean') throw compileErr(TX`Burada yalnız ${q('new HashMap<>()')} və ${q(TX`new HashMap<>(capacity)`)} dəstəklənir.`, e.line);
      if (n < 0) throw new JavaError('runtime', TX`IllegalArgumentException: capacity ${n} ola bilməz.`, e.line);
      threshold = 1; while (threshold < n) threshold *= 2;
    }
    const o = this.alloc({kind:'object', zone:'free', cls:'HashMap', fields:[
      {name:'size', t:'int', val:{t:'int', v:0}},
      {name:'threshold', t:'int', val:{t:'int', v:threshold}},
      {name:'table', t:'Node[]', val:{t:'Node[]', r:null}},
    ]});
    this.note(TX`${q('new HashMap')} heap-də object yaratdı. ${q('table')} hələ ${q('null')}-dur: bucket array-i ilk ${q('put')}-da yaranacaq.`);
    return {t:e.gt, r:o.id};
  }
  hashOf(v) {
    if (v.r === null || v.r === undefined) return 0;
    const o = this.byId[v.r];
    if (o.kind === 'string') return JHASH.str(o.value);
    if (o.kind === 'box') {
      switch (o.cls) {
        case 'Boolean': return o.value ? 1231 : 1237;
        case 'Long': return (Math.floor(o.value / 4294967296) | 0) ^ (o.value | 0);
        case 'Double': return JHASH.bits(o.value);
        case 'Float': return JHASH.bits(o.value, true);
        default: return o.value | 0;
      }
    }
    const hm = o.kind === 'object' && this.findM(o.cls, 'hashCode');
    if (hm) return this.invoke(hm, {t:o.cls, r:o.id}, [], this.line).v;
    const cl = o.kind === 'object' && this.prog.classes[o.cls];
    if (cl && cl.isRecord) return o.fields.reduce((acc, f) => {
      const part = f.val.r === undefined ? this.primHash(f.val.t, f.val.v) : this.hashOf(f.val);
      return (Math.imul(acc, 31) + part) | 0;
    }, 0);
    this.note(TX`${q(this.classOf(o))} öz ${q('hashCode')} method-unu yazmayıb. Real JVM-də bu hash hər işə salmada fərqli ola bilər, burada nümunə value-dur.`);
    return Math.imul(o.id, 40503) | 0;
  }
  primHash(t, v) {
    switch (t) {
      case 'boolean': return v ? 1231 : 1237;
      case 'long': return (Math.floor(v / 4294967296) | 0) ^ (v | 0);
      case 'double': return JHASH.bits(v);
      case 'float': return JHASH.bits(v, true);
      default: return v | 0;
    }
  }
  spread(h) { return h ^ (h >>> 16); }
  mapNodes(o) {
    const t = this.fv(o, 'table'), out = [];
    if (t.r === null) return out;
    for (const b of this.byId[t.r].elems) {
      let r = b.r;
      while (r) { const n = this.byId[r]; out.push(n); r = this.fv(n, 'next').r; }
    }
    return out;
  }
  mapResize(o) {
    const tv = this.fv(o, 'table'), old = tv.r ? this.byId[tv.r] : null;
    const oldCap = old ? old.elems.length : 0, oldThr = this.fv(o, 'threshold').v;
    const cap = oldCap > 0 ? oldCap * 2 : oldThr > 0 ? oldThr : 16;
    const thr = Math.floor(cap * 0.75);
    const elems = Array.from({length:cap}, () => ({t:'Node', r:null}));
    const tails = new Array(cap).fill(null);
    if (old) for (const b of old.elems) {
      let r = b.r;
      while (r) {
        const n = this.byId[r], nx = this.fv(n, 'next').r, i = (cap - 1) & this.fv(n, 'hash').v;
        n.fields.find(f => f.name === 'next').val = {t:'Node', r:null};
        if (tails[i]) tails[i].fields.find(f => f.name === 'next').val = {t:'Node', r:n.id};
        else elems[i] = {t:'Node', r:n.id};
        tails[i] = n; r = nx; this.touch('o' + n.id);
      }
    }
    const arr = this.alloc({kind:'array', zone:'free', cls:'Node[]', elemT:'Node', elems});
    this.setF(o, 'table', {t:'Node[]', r:arr.id});
    this.setF(o, 'threshold', {t:'int', v:thr});
    this.note(oldCap
      ? TX`${q('size')} threshold-u keçdi: ${cap} bucket-lik yeni array yaradıldı. Node-lar köçürüldü və index-ləri yeni capacity-yə görə yenidən hesablandı.`
      : TX`Heap-də ${cap} bucket-lik ${q('Node[]')} array-i yaradıldı. Yeni threshold: ${thr} (capacity-nin 75%-i).`);
  }
  mapFind(o, key, h) {
    const t = this.fv(o, 'table');
    if (t.r === null) return null;
    const arr = this.byId[t.r];
    let r = arr.elems[(arr.elems.length - 1) & h].r;
    while (r) {
      const n = this.byId[r];
      if (this.fv(n, 'hash').v === h && this.sameContent(this.fv(n, 'key'), key)) return n;
      r = this.fv(n, 'next').r;
    }
    return null;
  }
  mapMethod(o, v, e, args) {
    const [K = 'Object', V = 'Object'] = genArgs(v.t), n = e.name;
    const need = k => { if (args.length !== k) throw compileErr(TX`${q(n)} ${k} argument gözləyir, ${args.length} verildi.`, e.line); };
    const keyArg = a => a.r === undefined ? this.coerce(a, n === 'put' ? K : 'Object', e.line) : (n === 'put' ? this.coerce(a, K, e.line) : a);
    const typedV = x => Object.assign({}, x, {t:V});
    const setSize = k => this.setF(o, 'size', {t:'int', v:k});
    const size = this.fv(o, 'size').v;
    switch (n) {
      case 'put': {
        need(2);
        const key = keyArg(args[0]), val = this.coerce(args[1], V, e.line);
        const raw = this.hashOf(key), h = key.r === null ? 0 : this.spread(raw);
        if (this.fv(o, 'table').r === null) this.mapResize(o);
        let arr = this.byId[this.fv(o, 'table').r], cap = arr.elems.length, i = (cap - 1) & h;
        this.note(key.r === null
          ? TX`${q('null')} key-inin hash-i həmişə 0-dır, ona görə bucket 0 seçilir.`
          : TX`${q('hashCode()')} = ${raw}, spread hash = ${h}. Bucket: ${q('(' + cap + ' - 1) & ' + h)} = ${i}.`);
        const found = this.mapFind(o, key, h);
        if (found) {
          const old = this.fv(found, 'value');
          this.setF(found, 'value', {t:'Object', r:val.r});
          this.note(TX`Bu key artıq var: yeni Node yaranmadı, mövcud Node-un value reference-i dəyişdi.`);
          return typedV(old);
        }
        const node = this.alloc({kind:'object', zone:'free', cls:'HashMap.Node', fields:[
          {name:'hash', t:'int', val:{t:'int', v:h}},
          {name:'key', t:'Object', val:{t:'Object', r:key.r}},
          {name:'value', t:'Object', val:{t:'Object', r:val.r}},
          {name:'next', t:'Node', val:{t:'Node', r:null}},
        ]});
        if (arr.elems[i].r === null) {
          arr.elems[i] = {t:'Node', r:node.id}; this.touch('o' + arr.id);
          this.note(TX`Bucket ${i} boş idi: yeni ${q('Node')} birbaşa ora yazıldı. Key və value Node-un içində yox, reference ilə saxlanır.`);
        } else {
          let tail = this.byId[arr.elems[i].r], before = 1;
          while (this.fv(tail, 'next').r) { tail = this.byId[this.fv(tail, 'next').r]; before++; }
          this.setF(tail, 'next', {t:'Node', r:node.id});
          this.note(TX`Collision: bucket ${i} artıq doludur və key-lər fərqlidir. Yeni ${q('Node')} list-in sonuna ${q('next')} ilə bağlandı.`);
          if (before >= 8) {
            if (cap < 64) this.mapResize(o);
            else this.note(TX`Bu bucket-də 8-dən çox Node oldu. Real HashMap burada list-i tree-yə çevirir, bu alət onu sadəlik üçün list kimi göstərir.`);
          }
        }
        setSize(size + 1);
        if (size + 1 > this.fv(o, 'threshold').v) this.mapResize(o);
        return {t:V, r:null};
      }
      case 'get': case 'getOrDefault': case 'containsKey': case 'remove': {
        need(n === 'getOrDefault' ? 2 : 1);
        const key = keyArg(args[0]);
        const h = key.r === null ? 0 : this.spread(this.hashOf(key));
        const t = this.fv(o, 'table');
        const i = t.r ? (this.byId[t.r].elems.length - 1) & h : 0;
        const node = this.mapFind(o, key, h);
        if (t.r) this.note(TX`Hash birbaşa bucket ${i} cell-inə aparır: bütün table gəzilmir, yalnız bu bucket yoxlanır. ${node ? TX`Key tapıldı.` : TX`Key tapılmadı.`}`);
        else this.note(TX`${q('table')} hələ ${q('null')}-dur, key tapılmadı.`);
        if (n === 'containsKey') return {t:'boolean', v:!!node};
        if (n === 'get') return node ? typedV(this.fv(node, 'value')) : {t:V, r:null};
        if (n === 'getOrDefault') return node ? typedV(this.fv(node, 'value')) : this.coerce(args[1], V, e.line);
        if (!node) return {t:V, r:null};
        const arr = this.byId[t.r], first = arr.elems[i].r;
        if (first === node.id) arr.elems[i] = {t:'Node', r:this.fv(node, 'next').r};
        else {
          let p = this.byId[first];
          while (this.fv(p, 'next').r !== node.id) p = this.byId[this.fv(p, 'next').r];
          this.setF(p, 'next', {t:'Node', r:this.fv(node, 'next').r});
        }
        this.touch('o' + arr.id); setSize(size - 1);
        this.note(TX`${q('Node')} bucket-dən çıxarıldı. Table kiçilmir.`);
        return typedV(this.fv(node, 'value'));
      }
      case 'containsValue': {
        need(1);
        const a = args[0].r === undefined ? this.coerce(args[0], 'Object', e.line) : args[0];
        return {t:'boolean', v:this.mapNodes(o).some(x => this.sameContent(this.fv(x, 'value'), a))};
      }
      case 'size': need(0); return {t:'int', v:size};
      case 'isEmpty': need(0); return {t:'boolean', v:size === 0};
      case 'clear': {
        need(0); const t = this.fv(o, 'table');
        if (t.r) { const arr = this.byId[t.r]; arr.elems = arr.elems.map(() => ({t:'Node', r:null})); this.touch('o' + arr.id); }
        setSize(0);
        this.note(TX`Bütün bucket-lər boşaldı. Table-ın özü silinmir.`);
        return {t:'void', v:null};
      }
      case 'keySet': case 'values': case 'entrySet':
        throw compileErr(TX`${q(n + '()')} hələlik yalnız for-each daxilində işləyir: ${q('for (... : map.' + n + '())')}.`, e.line);
    }
    throw compileErr(TX`HashMap üçün ${q(n + '()')} hələ dəstəklənmir. İşləyənlər: put, get, getOrDefault, containsKey, containsValue, remove, size, isEmpty, clear, keySet, values, entrySet.`, e.line);
  }
  entryMethod(o, v, e, args) {
    const [K = 'Object', V = 'Object'] = genArgs(v.t);
    if (e.name === 'getKey') return Object.assign({}, this.fv(o, 'key'), {t:K});
    if (e.name === 'getValue') return Object.assign({}, this.fv(o, 'value'), {t:V});
    if (e.name === 'setValue') {
      const old = this.fv(o, 'value'), val = this.coerce(args[0], V, e.line);
      this.setF(o, 'value', {t:'Object', r:val.r});
      return Object.assign({}, old, {t:V});
    }
    throw compileErr(TX`${q('Map.Entry')} üçün ${q(e.name + '()')} dəstəklənmir. İşləyənlər: getKey, getValue, setValue.`, e.line);
  }
  iterable(it, line) {
    if (it.x === 'call' && it.target && ['keySet','values','entrySet'].includes(it.name) && !it.args.length) {
      const mv = this.eval(it.target);
      if (mv.r === null) throw new JavaError('runtime', TX`NullPointerException: variable null-dur, ${q(it.name + '()')} çağırmaq olmaz.`, line);
      const o = mv.r && this.byId[mv.r];
      if (o && o.cls === 'HashMap') {
        const [K = 'Object', V = 'Object'] = genArgs(mv.t);
        this.note(TX`HashMap elementləri bucket sırası ilə gəzilir, ona görə sıra əlavə etdiyin sıra ilə eyni olmaya bilər.`);
        return this.mapNodes(o).map(n => it.name === 'keySet' ? Object.assign({}, this.fv(n, 'key'), {t:K})
          : it.name === 'values' ? Object.assign({}, this.fv(n, 'value'), {t:V})
          : {t:`Map.Entry<${K},${V}>`, r:n.id});
      }
    }
    const a = this.eval(it);
    if (a.r === undefined) throw compileErr(TX`for-each array və ya collection ilə işləyir.`, line);
    if (a.r === null) throw new JavaError('runtime', TX`NullPointerException: null üzərində loop etmək olmaz.`, line);
    const o = this.byId[a.r];
    if (o.kind === 'array') return o.elems.map(x => Object.assign({}, x));
    const elemT = genArgs(a.t)[0] || 'Object';
    if (o.cls === 'ArrayList') return this.listItems(o).map(x => Object.assign({}, x, {t:elemT}));
    if (o.cls === 'LinkedList') return this.llNodes(o).map(n => Object.assign({}, this.fv(n, 'item'), {t:elemT}));
    if (o.cls === 'HashSet') {
      this.note(TX`HashSet elementləri bucket sırası ilə gəzilir, ona görə sıra əlavə etdiyin sıra ilə eyni olmaya bilər.`);
      return this.mapNodes(this.byId[this.fv(o, 'map').r]).map(n => Object.assign({}, this.fv(n, 'key'), {t:elemT}));
    }
    throw compileErr(TX`for-each ${q(this.classOf(o))} ilə işləmir.`, line);
  }
  evalEq(o, b, e) {
    let same = false;
    if (b) {
      if (o.kind === 'string' && b.kind === 'string') same = o.value === b.value;
      else if (o.kind === 'box' && b.kind === 'box') same = o.cls === b.cls && o.value === b.value;
      else same = o.id === b.id;
    }
    this.note(o.kind === 'string' || o.kind === 'box'
      ? TX`${q('equals')} reference-lərə yox, object-lərin content-inə baxır.`
      : TX`${q(o.cls)} ${q('equals')} method-unu özü yazmayıb, ona görə ${q('==')} kimi reference-ləri müqayisə edir.`);
    return {t:'boolean', v:same};
  }
  stringMethod(o, e, args) {
    const s = o.value, n = e.name;
    const fresh = (r) => {
      if (r === s) { this.note(TX`Mətn dəyişmədi, ona görə ${q(n + '()')} eyni object-i qaytardı.`); return {t:'String', r:o.id}; }
      this.note(TX`String immutable-dır: ${q(n + '()')} köhnə object-i dəyişmir, heap-də yeni object yaradır.`);
      return this.newString(r);
    };
    switch (n) {
      case 'length': return {t:'int', v:s.length};
      case 'isEmpty': return {t:'boolean', v:s.length === 0};
      case 'charAt': {
        const i = this.unboxed(args[0]).v;
        if (i < 0 || i >= s.length) throw new JavaError('runtime', TX`StringIndexOutOfBoundsException: ${i} index-i yoxdur. String-in length-i: ${s.length}.`, e.line);
        return {t:'char', v:s.charCodeAt(i)};
      }
      case 'intern': {
        const had = !!this.pool[s];
        const r = this.intern(s);
        this.notes = this.notes.filter(x => !x.includes('String Pool'));
        this.note(had ? TX`${q('intern()')} pool-dakı eyni mətnli object-i qaytardı.` : TX`${q('intern()')} bu mətni pool-a əlavə etdi.`);
        return {t:'String', r:r.r};
      }
      case 'toUpperCase': return fresh(s.toLocaleUpperCase('en'));
      case 'toLowerCase': return fresh(s.toLocaleLowerCase('en'));
      case 'trim': return fresh(s.trim());
      case 'concat': return fresh(s + this.str(args[0]));
      case 'toString': return {t:'String', r:o.id};
      case 'hashCode': return {t:'int', v:JHASH.str(s)};
      case 'substring': {
        const a = this.unboxed(args[0]).v, b = args[1] ? this.unboxed(args[1]).v : s.length;
        if (a < 0 || b > s.length || a > b) throw Object.assign(new JavaError('runtime', TX`StringIndexOutOfBoundsException: ${a} ... ${b} aralığı yoxdur. String-in length-i: ${s.length}.`, e.line), {real:`begin ${a}, end ${b}, length ${s.length}`});
        return fresh(s.slice(a, b));
      }
      case 'contains': return {t:'boolean', v:s.includes(this.str(args[0]))};
      case 'startsWith': return {t:'boolean', v:s.startsWith(this.str(args[0]))};
      case 'endsWith': return {t:'boolean', v:s.endsWith(this.str(args[0]))};
      case 'indexOf': return {t:'int', v:s.indexOf(this.str(args[0]))};
      case 'equalsIgnoreCase': return {t:'boolean', v:!!args[0].r && s.toLowerCase() === this.str(args[0]).toLowerCase()};
      case 'replace': return fresh(s.split(this.str(args[0])).join(this.str(args[1])));
    }
    throw compileErr(TX`String üçün ${q(n + '()')} hələ dəstəklənmir.`, e.line);
  }
}
/* value placeholder used by compound assignment */
const _eval = Interp.prototype.eval;
Interp.prototype.eval = function (e) { return e.x === '__v' ? e.v : _eval.call(this, e); };
