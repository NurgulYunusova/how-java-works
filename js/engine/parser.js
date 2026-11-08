/* ---------- Mini Java: tokenizer, parser, interpreter producing memory snapshots ---------- */
const PRIMS = ['byte','short','char','int','long','float','double','boolean'];
const BOX = {Byte:'byte',Short:'short',Character:'char',Integer:'int',Long:'long',Float:'float',Double:'double',Boolean:'boolean'};
const UNBOX_TO = {byte:'Byte',short:'Short',char:'Character',int:'Integer',long:'Long',float:'Float',double:'Double',boolean:'Boolean'};
const RANK = {byte:1,short:2,char:2,int:3,long:4,float:5,double:6};
const RANGE = {byte:[-128,127],short:[-32768,32767],char:[0,65535],int:[-2147483648,2147483647]};
const KEYWORDS_MOD = ['public','private','protected','static','final','abstract','synchronized','transient','volatile'];
const MAX_STEPS = 500, MAX_DEPTH = 40;
const EXC = {Throwable:null, Exception:'Throwable', Error:'Throwable', RuntimeException:'Exception', StackOverflowError:'Error',
  ArithmeticException:'RuntimeException', NullPointerException:'RuntimeException', IllegalArgumentException:'RuntimeException', IllegalStateException:'RuntimeException',
  ClassCastException:'RuntimeException', IndexOutOfBoundsException:'RuntimeException', ArrayIndexOutOfBoundsException:'IndexOutOfBoundsException', StringIndexOutOfBoundsException:'IndexOutOfBoundsException',
  NegativeArraySizeException:'RuntimeException', NumberFormatException:'IllegalArgumentException', UnsupportedOperationException:'RuntimeException', NoSuchElementException:'RuntimeException'};
const JDK = {ArrayList:1, HashMap:1, 'HashMap.Node':1, StringBuilder:1, HashSet:1, LinkedList:1, 'LinkedList.Node':1};
const erase = t => t.replace(/<.*>/, '');
function genArgs(t) {
  const m = /^[^<]*<(.*)>(?:\[\])*$/.exec(t);
  if (!m || !m[1]) return [];
  const out = []; let d = 0, cur = '';
  for (const c of m[1]) {
    if (c === '<') d++; else if (c === '>') d--;
    if (c === ',' && d === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map(a => a.replace(/^\?(?:extends|super)?/, '') || 'Object');
}
const SUPERS = {ArrayList:['List','Collection','Iterable'], HashMap:['Map'], 'HashMap.Node':['Map.Entry','Entry'], HashSet:['Set','Collection','Iterable'], LinkedList:['List','Collection','Iterable','Queue','Deque'], StringBuilder:['CharSequence']};
function assignable(dyn, target) {
  const t = erase(target);
  return dyn === t || (SUPERS[dyn] || []).includes(t);
}
const knownLib = t => ['List','Collection','Iterable','Map','Map.Entry','Entry','ArrayList','HashMap','Set','HashSet','LinkedList','Queue','Deque','StringBuilder','CharSequence'].includes(erase(t)) || erase(t) in EXC;
const JHASH = {
  str(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h; },
  bits(v, f) { const d = new DataView(new ArrayBuffer(8)); if (f) { d.setFloat32(0, v); return d.getInt32(0); } d.setFloat64(0, v === 0 && !Object.is(v, -0) ? 0 : v); return d.getInt32(0) ^ d.getInt32(4); },
};

class JavaError extends Error {
  constructor(kind, msg, line) { super(msg); this.kind = kind; this.line = line; }
}
const compileErr = (msg, line) => new JavaError('compile', msg, line);

function tokenize(src) {
  const toks = []; let i = 0, line = 1;
  const push = (k, v, extra) => toks.push(Object.assign({k, v, line}, extra));
  const OPS = ['>>>=','<<=','>>=','>>>','==','!=','<=','>=','&&','||','++','--','+=','-=','*=','/=','%=','<<','>>','->','::'];
  const ESC = {n:'\n',t:'\t',r:'\r',b:'\b',f:'\f','0':'\0','"':'"',"'":"'",'\\':'\\'};
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (src.startsWith('/*', i)) {
      const e = src.indexOf('*/', i + 2), stop = e < 0 ? src.length : e + 2;
      for (let j = i; j < stop; j++) if (src[j] === '\n') line++;
      i = stop; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '', closed = false;
      while (j < src.length && src[j] !== '\n') {
        if (src[j] === '\\') { s += ESC[src[j+1]] ?? src[j+1]; j += 2; continue; }
        if (src[j] === c) { closed = true; break; }
        s += src[j++];
      }
      if (!closed) { push('bad', c === '"' ? TX`String-in sonunda dırnaq (") çatmır.` : TX`Character-in sonunda dırnaq (') çatmır.`); i = j; continue; }
      if (c === "'" && [...s].length !== 1) { push('bad', TX`char type-ı tək character saxlayır. Mətn üçün String və "..." yaz.`); i = j + 1; continue; }
      push(c === '"' ? 'str' : 'chr', s); i = j + 1; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i+1] || ''))) {
      const m = /^(?:0[xX][0-9a-fA-F_]+|\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)[lLfFdD]?/.exec(src.slice(i));
      const raw = m[0]; let body = raw.replace(/_/g,''), t = 'int';
      const hex = /^0[xX]/.test(body);
      const last = body[body.length-1];
      if (/[lL]/.test(last)) { t = 'long'; body = body.slice(0,-1); }
      else if (!hex && /[fF]/.test(last)) { t = 'float'; body = body.slice(0,-1); }
      else if (!hex && /[dD]/.test(last)) { t = 'double'; body = body.slice(0,-1); }
      else if (!hex && /[.eE]/.test(body)) t = 'double';
      push('num', Number(body), {t}); i += raw.length; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1; while (j < src.length && /[\w$]/.test(src[j])) j++;
      push('id', src.slice(i, j)); i = j; continue;
    }
    const op = OPS.find(o => src.startsWith(o, i));
    if (op) { push('op', op); i += op.length; continue; }
    push('op', c); i++;
  }
  toks.push({k:'eof', v:'', line});
  return toks;
}

class Parser {
  constructor(toks) { this.t = toks; this.p = 0; }
  get cur() { return this.t[this.p]; }
  peek(n = 1) { return this.t[Math.min(this.p + n, this.t.length - 1)]; }
  is(v) { return this.cur.v === v && (this.cur.k === 'op' || this.cur.k === 'id'); }
  eat(v) { if (this.is(v)) { this.p++; return true; } return false; }
  fail(msg, line) { throw compileErr(msg, line ?? this.cur.line); }
  need(v) {
    const c = this.cur;
    if (c.k === 'bad') this.fail(c.v);
    if (!this.eat(v)) {
      const prev = this.t[this.p - 1];
      this.fail(v === ';' ? TX`Sətrin sonunda semicolon (;) çatmır.` : TX`Burada \`${v}\` gözlənilirdi.`, v === ';' && prev ? prev.line : c.line);
    }
  }
  ident(what = TX`ad`) {
    const c = this.cur;
    if (c.k === 'bad') this.fail(c.v);
    if (c.k !== 'id') this.fail(TX`Burada ${what} gözlənilirdi.`);
    this.p++; return c.v;
  }
  /* Returns index after a type starting at position p, or -1 */
  typeEnd(p) {
    const c = this.t[p];
    if (!c || c.k !== 'id') return -1;
    p++;
    while (this.t[p] && this.t[p].v === '.' && this.t[p+1] && this.t[p+1].k === 'id') p += 2;
    if (this.t[p] && this.t[p].v === '<') {
      let d = 0, q = p;
      for (;;) {
        const x = this.t[q];
        if (!x || x.k === 'eof') return -1;
        if (x.v === '<') d++;
        else if (x.v === '>') d--;
        else if (x.v === '>>') d -= 2;
        else if (x.v === '>>>') d -= 3;
        else if (!(x.k === 'id' || [',','?','[',']','.'].includes(x.v))) return -1;
        q++;
        if (d <= 0) break;
      }
      if (d < 0) return -1;
      p = q;
    }
    while (this.t[p] && this.t[p].v === '[' && this.t[p+1] && this.t[p+1].v === ']') p += 2;
    return p;
  }
  isDecl() {
    const c = this.cur;
    const e = this.typeEnd(this.p);
    return e > 0 && this.t[e].k === 'id' && !['instanceof'].includes(this.t[e].v) && !['return','new','throw','else'].includes(c.v);
  }
  type() {
    const c = this.cur; if (c.k === 'bad') this.fail(c.v);
    if (c.k !== 'id') this.fail(TX`Burada type gözlənilirdi.`);
    const e = this.typeEnd(this.p);
    if (e < 0) this.fail(TX`Type yarımçıq yazılıb: bağlanan > çatmır.`);
    let n = '';
    for (let i = this.p; i < e; i++) n += this.t[i].v;
    if (/[<,](int|long|short|byte|char|float|double|boolean)(?![\w\[])/.test(n)) {
      const bad = /[<,](int|long|short|byte|char|float|double|boolean)/.exec(n)[1];
      this.fail(TX`Generic type kimi primitive olmaz: ${bad} yerinə ${UNBOX_TO[bad]} yaz.`);
    }
    this.p = e;
    return n;
  }
  mods() {
    const m = {};
    while (this.cur.k === 'id' && KEYWORDS_MOD.includes(this.cur.v)) { m[this.cur.v] = true; this.p++; }
    return m;
  }
  program() {
    const prog = {classes:{}, methods:{}, body:[], error:null};
    try {
      while (this.cur.k !== 'eof') {
        if (this.is('import') || this.is('package')) { while (!this.eat(';') && this.cur.k !== 'eof') this.p++; continue; }
        const start = this.p, m = this.mods();
        if (this.is('class') || this.is('interface')) { const cl = this.classDecl(m); prog.classes[cl.name] = cl; continue; }
        if (this.is('enum') && this.peek().k === 'id') { const cl = this.enumDecl(); prog.classes[cl.name] = cl; continue; }
        if (this.is('record') && this.peek().k === 'id' && this.peek(2).v === '(') { const cl = this.recordDecl(); prog.classes[cl.name] = cl; continue; }
        const e = this.typeEnd(this.p);
        if (e > 0 && this.t[e].k === 'id' && this.t[e+1] && this.t[e+1].v === '(') {
          const me = this.method(m, null); me.isStatic = true; prog.methods[me.name] = me; continue;
        }
        this.p = start;
        prog.body.push(...this.statements1());
      }
    } catch (err) { if (err instanceof JavaError) prog.error = err; else throw err; }
    return prog;
  }
  classDecl(mods = {}) {
    const line = this.cur.line, isInterface = this.is('interface'); this.p++;
    const name = this.ident(TX`class adı`);
    const cl = {name, fields:[], methods:{}, ctors:[], line, sup:null, ifaces:[], isInterface, isAbstract:!!mods.abstract || isInterface};
    if (this.eat('extends')) {
      if (isInterface) do { cl.ifaces.push(erase(this.type())); } while (this.eat(','));
      else cl.sup = erase(this.type());
    }
    if (this.eat('implements')) do { cl.ifaces.push(erase(this.type())); } while (this.eat(','));
    this.members(cl);
    return cl;
  }
  members(cl) {
    const name = cl.name;
    this.need('{');
    while (!this.is('}')) {
      if (this.cur.k === 'eof') this.fail(TX`${name} class-ının sonunda } çatmır.`);
      if (this.eat(';')) continue;
      const m = this.mods();
      if (this.eat('default')) m.isDefault = true;
      if (this.cur.v === name && this.peek().v === '(') { cl.ctors.push(this.method(m, name, true)); continue; }
      const e = this.typeEnd(this.p);
      if (e > 0 && this.t[e].k === 'id' && this.t[e+1] && this.t[e+1].v === '(') {
        const me = this.method(m, name); cl.methods[me.name] = me; continue;
      }
      const t = this.type();
      do {
        const fname = this.ident(TX`field adı`);
        const f = {name:fname, t, isStatic:!!m.static || !!cl.isInterface, isFinal:!!m.final || !!cl.isInterface, line:this.cur.line};
        if (this.eat('=')) f.init = this.varInit();
        cl.fields.push(f);
      } while (this.eat(','));
      this.need(';');
    }
    this.need('}');
  }
  enumDecl() {
    const line = this.cur.line; this.p++;
    const name = this.ident(TX`class adı`);
    this.need('{');
    const consts = [];
    while (this.cur.k === 'id') {
      consts.push(this.ident());
      if (this.is('(') || this.is('{')) this.fail(TX`Burada yalnız sadə enum dəstəklənir: ${'enum Rang { QIRMIZI, YASIL }'}.`);
      if (!this.eat(',')) break;
    }
    this.eat(';');
    if (!this.is('}')) this.fail(TX`Burada yalnız sadə enum dəstəklənir: ${'enum Rang { QIRMIZI, YASIL }'}.`);
    this.need('}');
    return {name, fields:[], methods:{}, ctors:[], line, sup:null, ifaces:[], isEnum:true, consts};
  }
  recordDecl() {
    const line = this.cur.line; this.p++;
    const name = this.ident(TX`class adı`);
    const cl = {name, fields:[], methods:{}, ctors:[], line, sup:null, ifaces:[], isRecord:true};
    this.need('(');
    if (!this.is(')')) do {
      const t = this.type();
      cl.fields.push({name:this.ident(TX`field adı`), t, isFinal:true, isStatic:false, line});
    } while (this.eat(','));
    this.need(')');
    if (this.eat('implements')) do { cl.ifaces.push(erase(this.type())); } while (this.eat(','));
    this.members(cl);
    return cl;
  }
  method(m, cls, isCtor) {
    const line = this.cur.line;
    const ret = isCtor ? null : this.type();
    const name = this.ident(TX`method adı`);
    this.need('(');
    const params = [];
    if (!this.is(')')) do {
      this.mods();
      const t = this.type();
      params.push({t, name:this.ident(TX`parameter adı`)});
    } while (this.eat(','));
    this.need(')');
    if (this.is('throws')) { while (!this.is('{') && this.cur.k !== 'eof') this.p++; }
    const body = this.is(';') ? (this.p++, null) : this.block();
    return {name, ret, params, body, cls, isStatic:!!m.static, line};
  }
  block() {
    const line = this.cur.line; this.need('{');
    const stmts = [];
    while (!this.is('}')) {
      if (this.cur.k === 'eof') this.fail(TX`Block-un sonunda } çatmır.`);
      stmts.push(...this.statements1());
    }
    const endLine = this.cur.line; this.need('}');
    return {s:'block', stmts, line, endLine};
  }
  /* one source statement; a declaration with several names yields several nodes */
  statements1() {
    const c = this.cur, line = c.line;
    if (c.k === 'bad') this.fail(c.v);
    if (this.eat(';')) return [];
    if (this.is('{')) return [this.block()];
    if (this.eat('if')) {
      this.need('('); const cond = this.expr(); this.need(')');
      const th = this.single(); let el = null;
      if (this.eat('else')) el = this.single();
      return [{s:'if', cond, th, el, line}];
    }
    if (this.eat('while')) {
      this.need('('); const cond = this.expr(); this.need(')');
      return [{s:'while', cond, body:this.single(), line}];
    }
    if (this.eat('for')) return [this.forStmt(line)];
    if (this.eat('return')) {
      let e = null; if (!this.is(';')) e = this.expr();
      this.need(';'); return [{s:'return', e, line}];
    }
    if (this.eat('try')) {
      const body = this.block(), catches = [];
      while (this.is('catch')) {
        const cl = this.cur.line; this.p++;
        this.need('('); this.mods();
        const types = [];
        do { types.push(erase(this.type())); } while (this.eat('|'));
        const name = this.ident(TX`variable adı`);
        this.need(')');
        catches.push({types, name, body:this.block(), line:cl});
      }
      const fin = this.eat('finally') ? this.block() : null;
      if (!catches.length && !fin) this.fail(TX`${'try'} block-undan sonra ${'catch'} və ya ${'finally'} yaz.`);
      return [{s:'try', body, catches, fin, line}];
    }
    if (this.eat('throw')) { const ex = this.expr(); this.need(';'); return [{s:'throw', e:ex, line}]; }
    if (this.eat('break')) { this.need(';'); return [{s:'break', line}]; }
    if (this.eat('continue')) { this.need(';'); return [{s:'continue', line}]; }
    if (['switch','do','class'].includes(c.v) && c.k === 'id') this.fail(TX`\`${c.v}\` hələ dəstəklənmir. Variable-lar, object-lər, array-lər, if, for, while, try və method-lar işləyir.`);
    const m = this.mods();
    if (this.isDecl()) { const d = this.decl(m); this.need(';'); return d; }
    const e = this.expr(); this.need(';');
    return [{s:'expr', e, line}];
  }
  single() {
    const r = this.statements1();
    return r.length === 1 ? r[0] : {s:'block', stmts:r, line:this.cur.line, endLine:this.cur.line};
  }
  decl(m) {
    const t0 = this.type(), out = [];
    do {
      const line = this.cur.line;
      const name = this.ident(TX`variable adı`);
      let t = t0;
      while (this.is('[') && this.peek().v === ']') { this.p += 2; t += '[]'; }
      let init = null;
      if (this.eat('=')) init = this.varInit();
      out.push({s:'decl', t, name, init, isFinal:!!m.final, line});
    } while (this.eat(','));
    return out;
  }
  varInit() {
    if (this.is('{')) return this.arrayLit();
    return this.expr();
  }
  arrayLit() {
    const line = this.cur.line; this.need('{');
    const items = [];
    while (!this.is('}')) {
      items.push(this.varInit());
      if (!this.eat(',')) break;
    }
    this.need('}');
    return {x:'arrlit', items, line};
  }
  forStmt(line) {
    this.need('(');
    const start = this.p, m = this.mods();
    if (this.isDecl()) {
      const e = this.typeEnd(this.p);
      if (this.t[e+1] && this.t[e+1].v === ':') {
        const t = this.type(), name = this.ident(); this.need(':');
        const it = this.expr(); this.need(')');
        return {s:'foreach', t, name, it, body:this.single(), line};
      }
    }
    this.p = start;
    let init = [];
    if (!this.is(';')) {
      const m2 = this.mods();
      if (this.isDecl()) init = this.decl(m2);
      else { do { init.push({s:'expr', e:this.expr(), line}); } while (this.eat(',')); }
    }
    this.need(';');
    const cond = this.is(';') ? null : this.expr(); this.need(';');
    const upd = [];
    if (!this.is(')')) do { upd.push({s:'expr', e:this.expr(), line}); } while (this.eat(','));
    this.need(')');
    return {s:'for', init, cond, upd, body:this.single(), line};
  }
  expr() { return this.assign(); }
  assign() {
    const l = this.ternary(), c = this.cur;
    if (c.k === 'op' && ['=','+=','-=','*=','/=','%='].includes(c.v)) {
      if (!['id','member','index'].includes(l.x)) this.fail(TX`Bu ifadəyə value yazmaq olmaz.`);
      this.p++;
      const r = this.is('{') ? this.arrayLit() : this.assign();
      return {x:'assign', op:c.v, l, r, line:c.line};
    }
    return l;
  }
  ternary() {
    const c = this.bin(0);
    if (this.is('?')) {
      this.p++; const a = this.expr(); this.need(':'); const b = this.ternary();
      return {x:'cond', c, a, b};
    }
    return c;
  }
  bin(lv) {
    const L = [['||'],['&&'],['==','!='],['<','>','<=','>='],['+','-'],['*','/','%']];
    if (lv >= L.length) return this.unary();
    let l = this.bin(lv + 1);
    while (this.cur.k === 'op' && L[lv].includes(this.cur.v)) {
      const op = this.cur.v, line = this.cur.line; this.p++;
      l = {x:'bin', op, l, r:this.bin(lv + 1), line};
    }
    if (lv === 3 && this.is('instanceof')) { const line = this.cur.line; this.p++; l = {x:'instanceof', e:l, t:this.type(), line}; }
    return l;
  }
  unary() {
    const c = this.cur;
    if (c.k === 'op' && ['-','+','!'].includes(c.v)) { this.p++; return {x:'un', op:c.v, e:this.unary(), line:c.line}; }
    if (c.k === 'op' && (c.v === '++' || c.v === '--')) { this.p++; return {x:'incdec', op:c.v, prefix:true, e:this.unary(), line:c.line}; }
    if (c.v === '(' && this.peek().k === 'id') {
      const e = this.typeEnd(this.p + 1);
      if (e > 0 && this.t[e].v === ')') {
        const nm = this.peek().v, nx = this.t[e+1];
        if (PRIMS.includes(nm) || (/^[A-Z]/.test(nm) && nx && (nx.k !== 'op' || nx.v === '('))) {
          this.p++; const t = this.type(); this.need(')');
          return {x:'cast', t, e:this.unary(), line:c.line};
        }
      }
    }
    return this.postfix();
  }
  postfix() {
    let e = this.primary();
    for (;;) {
      const c = this.cur;
      if (this.eat('.')) {
        const name = this.ident(TX`member adı`);
        if (this.is('(')) e = {x:'call', target:e, name, args:this.args(), line:c.line};
        else e = {x:'member', o:e, name, line:c.line};
      } else if (this.is('[')) {
        this.p++; const i = this.expr(); this.need(']');
        e = {x:'index', a:e, i, line:c.line};
      } else if (c.k === 'op' && (c.v === '++' || c.v === '--')) {
        this.p++; e = {x:'incdec', op:c.v, prefix:false, e, line:c.line};
      } else return e;
    }
  }
  args() {
    this.need('('); const a = [];
    if (!this.is(')')) do { a.push(this.expr()); } while (this.eat(','));
    this.need(')'); return a;
  }
  primary() {
    const c = this.cur, line = c.line;
    if (c.k === 'bad') this.fail(c.v);
    if (c.k === 'num') {
      this.p++;
      if (c.t === 'int' && (c.v > 2147483648)) this.fail(TX`${c.v} int üçün çox böyükdür. long üçün sonuna L yaz.`, line);
      return {x:'lit', t:c.t, v:c.v, line};
    }
    if (c.k === 'str') { this.p++; return {x:'str', v:c.v, line}; }
    if (c.k === 'chr') { this.p++; return {x:'lit', t:'char', v:c.v.codePointAt(0), line}; }
    if (this.eat('(')) { const e = this.expr(); this.need(')'); return e; }
    if (c.k !== 'id') {
      this.fail(c.k === 'eof' ? TX`Sətir yarımçıq qalıb.` : TX`\`${c.v}\` burada gözlənilmirdi.`);
    }
    if (c.v === 'true' || c.v === 'false') { this.p++; return {x:'lit', t:'boolean', v:c.v === 'true', line}; }
    if (c.v === 'null') { this.p++; return {x:'null', line}; }
    if (c.v === 'new') { this.p++; return this.newExpr(line); }
    this.p++;
    if (this.is('(')) return {x:'call', target:null, name:c.v, args:this.args(), line};
    return {x:'id', name:c.v, line};
  }
  newExpr(line) {
    const name = this.ident(TX`type`);
    let gt = name;
    if (this.is('<')) { this.p--; gt = this.type(); }
    if (this.is('[')) {
      const dims = []; let t = name;
      while (this.is('[')) {
        this.p++;
        if (this.eat(']')) { t += '[]'; dims.push(null); continue; }
        dims.push(this.expr()); this.need(']'); t += '[]';
      }
      if (this.is('{')) { const lit = this.arrayLit(); lit.t = t; return lit; }
      return {x:'newarr', t, dims, line};
    }
    return {x:'new', cls:name, gt:gt.replace('<>', ''), args:this.args(), line};
  }
}
