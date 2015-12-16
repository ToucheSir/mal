'use strict';
import * as t from './types';
import {readline} from './node_readline';
import {printString} from './printer';
import {readString} from './reader';
import {readFileSync} from 'fs';
import {HasMeta} from "./types";
import {map as mapIter} from './itertools';
import {isSequential} from "./types";

const coreNS: Map<symbol, t.MalFunction> = new Map();

function addCoreFn(name: string, fn: (...args: t.MalType[]) => t.MalType) {
  coreNS.set(t.createSymbol(name), t.createMalFunction(fn));
}

namespace math {
  function ADD(a: number, b: number): number {
    return a + b;
  }

  function SUB(a: number, b: number): number {
    return a - b;
  }

  function MUL(a: number, b: number): number {
    return a * b;
  }

  function DIV(a: number, b: number): number {
    return a / b;
  }

  addCoreFn('+', ADD);
  addCoreFn('-', SUB);
  addCoreFn('*', MUL);
  addCoreFn('/', DIV);
}

namespace seq {
  function isEmpty(l: t.MalSeq): boolean {
    return l.length === 0;
  }

  function count(l: t.MalSeq): number {
    return l === t.NIL ? 0 : l.length;
  }

  function cons(a: t.MalType, l: t.MalSeq): t.MalList {
    return l.cons(a);
  }

  function conj(l: t.MalSeq, ...args: t.MalType[]): t.MalSeq {
    return l.conj(...args);
  }

  function concat(...args: t.MalSeq[]): t.MalList {
    // TODO remove cast escape hatch
    return <t.MalList>args.reduce((acc, l) => acc.concat(l), new t.MalList());
  }

  function nth(seq: t.MalSeq, index: number): t.MalType {
    return seq.nth(index);
  }

  function first(seq: t.MalSeq): t.MalType {
    return seq.first();
  }

  function rest(seq: t.MalSeq): t.MalList {
    return seq.rest();
  }

  function apply(func: t.MalFunction, ...args: t.MalType[]): t.MalType {
    const last = args.pop();
    if (t.isSequential(last)) {
      return func.fn(...args, ...last);
    }

    throw new Error('apply called with non-sequence argument');
  }

  function map(func: t.MalFunction, seq: t.MalSeq): t.MalList {
    return t.MalList.of(...mapIter(v => func.fn(v), seq));
  }

  addCoreFn('list', t.MalList.of);
  addCoreFn('list?', t.isList);
  addCoreFn('vector', t.MalVector.of);
  addCoreFn('vector?', t.isVector);

  addCoreFn('empty?', isEmpty);
  addCoreFn('count', count);

  addCoreFn('cons', cons);
  addCoreFn('conj', conj);
  addCoreFn('concat', concat);

  addCoreFn('nth', nth);
  addCoreFn('first', first);
  addCoreFn('rest', rest);

  addCoreFn('apply', apply);
  addCoreFn('map', map);

  addCoreFn('sequential?', t.isSequential);
}

namespace cmp {
  function mapEquals(a: Map<string, t.MalType>, b: typeof a): boolean {
    if (a.size !== b.size) {
      return false;
    }

    for (const kv of a) {
      if (!equals(b.get(kv[0]), kv[1])) {
        return false;
      }
    }

    return true;
  }

  function equals(a: t.MalType, b: t.MalType): boolean {
    if (t.isSequential(a) && t.isSequential(b)) {
      return a.equals(b, equals);
    } else if (t.isMap(a) && t.isMap(b)) {
      return mapEquals(a, b);
    } else if (t.isKeyword(a) && t.isKeyword(b)) {
      return a.toStringKey() === b.toStringKey()
    } else if (typeof a === typeof b) {
      return a === b;
    }

    return false;
  }

  function ge(a: number, b: number): boolean {
    return a >= b;
  }

  function le(a: number, b: number): boolean {
    return a <= b;
  }

  function gt(a: number, b: number): boolean {
    return a > b;
  }

  function lt(a: number, b: number): boolean {
    return a < b;
  }

  addCoreFn('=', equals);
  addCoreFn('<', lt);
  addCoreFn('<=', le);
  addCoreFn('>', gt);
  addCoreFn('>=', ge);
}

namespace io {
  function prStr(...args: t.MalType[]): string {
    return args.map<string>(x => printString(x, true)).join(' ');
  }

  function str(...args: t.MalType[]): string {
    return args.map<string>(x => printString(x, false)).join('');
  }

  function prn(...args: t.MalType[]) {
    console.log(prStr(...args));
    return t.NIL;
  }

  function println(...args: t.MalType[]) {
    console.log(args.map<string>(x => printString(x, false)).join(' '));
    return t.NIL;
  }

  function slurp(fileName: string): string {
    return readFileSync(fileName, 'utf-8');
  }

  addCoreFn('pr-str', prStr);
  addCoreFn('str', str);
  addCoreFn('prn', prn);
  addCoreFn('println', println);

  addCoreFn('read-string', readString);
  addCoreFn('slurp', slurp);
}

namespace err {
  function throwErr(e: t.MalType): t.MalType {
    throw e;
  }

  addCoreFn('throw', throwErr);
}

namespace map {
  function toMap(...args: t.MalType[]): t.MalHashMap {
    const res: t.MalMap = new Map();

    for (let i = 0; i < args.length - 1; i += 2) {
      res.set(t.objToKey(args[i]), args[i + 1]);
    }

    return res;
  }

  function assoc(m: t.MalMap, ...args: t.MalType[]): t.MalHashMap {
    const res = new Map(m.entries());

    for (let i = 0; i < args.length - 1; i += 2) {
      res.set(t.objToKey(args[i]), args[i + 1]);
    }

    return res;
  }

  function dissoc(m: t.MalMap, ...args: t.MalType[]): t.MalHashMap {
    const res = new Map(m.entries());

    for (const key of args) {
      res.delete(t.objToKey(key));
    }

    return res;
  }

  function getFrom(m: t.MalType, k: t.MalType): t.MalType {
    const key = t.objToKey(k);
    //console.log([m, k, key]);
    return t.isMap(m) && m.has(key) ? m.get(key) : t.NIL;
  }

  function containsKey(m: t.MalHashMap, k: t.MalType): boolean {
    const key = t.objToKey(k);
    return m.has(key);
  }

  function keys(m: t.MalHashMap): t.MalSeq {
    return t.MalList.of(...mapIter(k => k[0] === t.KEYWORD_PREFIX ? new t.MalKeyword(k.slice(1)) : k, m.keys()));
  }

  function vals(m: t.MalHashMap): t.MalSeq {
    return t.MalList.of(...m.values());
  }

  addCoreFn('hash-map', toMap);
  addCoreFn('map?', t.isMap);
  addCoreFn('assoc', assoc);
  addCoreFn('dissoc', dissoc);
  addCoreFn('get', getFrom);
  addCoreFn('contains?', containsKey);
  addCoreFn('keys', keys);
  addCoreFn('vals', vals);
}

namespace meta {
  // FIXME this is wrong for the new collections
  function cloneObj(o: t.MalType): typeof o {
    if (typeof o !== 'object') {
      return o;
    }

    if (t.isSequential(o)) {
      return o.clone();
    }

    const res = o instanceof Map ?
        new Map(o.entries()) :
        Object.assign({}, o);
    for (const sym of Object.getOwnPropertySymbols(o)) {
      (<any>res)[sym] = (<any>o)[sym];
    }

    return res;
  }

  function withMeta(obj: t.HasMeta & t.MalType, meta: t.MalType): t.HasMeta & t.MalType {
    const res = cloneObj(obj);
    (res as any)[t.MAL_META] = meta;

    return res;
  }

  function meta(obj: t.HasMeta): t.MalType {
    return (obj as any)[t.MAL_META] || t.NIL as t.MalType;
  }

  addCoreFn('with-meta', withMeta);
  addCoreFn('meta', meta);
}

namespace atom {
  function reset(a: t.MalAtom, val: t.MalType): typeof val {
    a.value = val;
    return val;
  }

  function swap(a: t.MalAtom, f: t.MalFunction, ...args: t.MalType[]): t.MalType {
    return reset(a, f.fn(a.value, ...args));
  }

  addCoreFn('atom', t.createAtom);
  addCoreFn('atom?', t.isAtom);
  addCoreFn('deref', (x: t.MalAtom) => x.value);
  addCoreFn('reset!', reset);
  addCoreFn('swap!', swap);
}

namespace primitives {
  addCoreFn('nil?', x => x === t.NIL);
  addCoreFn('true?', x => x === true);
  addCoreFn('false?', x => x === false);

  addCoreFn('symbol', t.createSymbol);
  addCoreFn('symbol?', t.isSymbol);

  addCoreFn('keyword', t.createKeyword);
  addCoreFn('keyword?', t.isKeyword);
}

namespace performance {
  function timeMs() {
    const hrtimestamp = process.hrtime();
    return hrtimestamp[0] * 1e3 + hrtimestamp[1] / 1e6;
  }

  addCoreFn('time-ms', timeMs);
}

namespace repl {
  addCoreFn('readline', readline);
}

export default coreNS;
