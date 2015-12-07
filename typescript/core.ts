import {MalSeq} from "./types";
'use strict';
import * as t from './types';
import {Env} from "./env";
import {printString} from "./printer";
import {readString} from "./reader";
import {readFileSync} from 'fs';
import {readline} from "./node_readline";
import {isType} from "./types";

const coreNS: Map<symbol, t.MalFunction> = new Map();

function addCoreFn(name: string, fn: (args: t.MalType[]) => t.MalType) {
  coreNS.set(Symbol.for(name), t.MalFunction(fn));
}
function addCoreFnMal(name: string, fn: t.MalFunction) {
  coreNS.set(Symbol.for(name), fn);
}

namespace math {
  function ADD(a: t.MalNumber, b: t.MalNumber): t.MalNumber {
    return t.MalNumber(a.value + b.value);
  }
  function SUB(a: t.MalNumber, b: t.MalNumber): t.MalNumber {
    return t.MalNumber(a.value - b.value);
  }
  function MUL(a: t.MalNumber, b: t.MalNumber): t.MalNumber {
    return t.MalNumber(a.value * b.value);
  }
  function DIV(a: t.MalNumber, b: t.MalNumber): t.MalNumber {
    return t.MalNumber(a.value / b.value);
  }

  addCoreFnMal('+', t.createBinFunction(ADD));
  addCoreFnMal('-', t.createBinFunction(SUB));
  addCoreFnMal('*', t.createBinFunction(MUL));
  addCoreFnMal('/', t.createBinFunction(DIV));
}

namespace seq {
  function isList(a: t.MalType): t.MalBool {
    return t.MalBool(t.isType(a, 'list'));
  }
  function isEmpty(l: t.MalList): t.MalBool {
    return t.MalBool(l.value.length === 0);
  }
  function count(l: t.MalList): t.MalNumber {
    return t.MalNumber(l === t.NIL ? 0 : l.value.length);
  }

  function cons(a: t.MalType, l: t.MalSeq): t.MalList {
    return t.MalList([a].concat(l.value));
  }
  function conj(args: t.MalType[]): t.MalSeq {
    const l = args[0] as t.MalSeq;
    const rest = args.slice(1);
    if (isType(l, 'vector')) {
      return t.MalVector(l.value.concat(rest));
    }

    const res: MalSeq = {
      typeTag: l.typeTag,
      value: l.value.slice()
    };
    for (const val of rest) {
      res.value.unshift(val);
    }
    return res;
  }
  function concat(args: t.MalSeq[]): t.MalList {
    return t.MalList(args.reduce((acc, l) => acc.concat(l.value), []));
  }

  function nth(seq: t.MalSeq, index: t.MalNumber): t.MalType {
    const s = seq.value;
    const i = index.value;

    if (i < 0 || i >= s.length) {
      throw new Error(`index ${i} out of range`);
    }
    return s[i];
  }
  function first(seq: t.MalSeq): t.MalList {
    return seq.value.length === 0 ? t.NIL : seq.value[0];
  }
  function rest(seq: t.MalSeq): t.MalList {
    return t.MalList(seq.value.slice(1));
  }

  function apply(args: t.MalType[]): t.MalType {
    const a = args.slice();
    const func = a.shift() as t.MalFunction;
    const last = a.pop() as t.MalSeq;

    return func.value(a.concat(last.value));
  }
  function map(fn: t.MalFunction, seq: t.MalSeq): t.MalList {
    return t.MalList(seq.value.map(v => fn.value([v])));
  }

  addCoreFn('list', t.MalList);
  addCoreFnMal('list?', t.createUnFunction(isList));
  addCoreFn('vector', t.MalVector);
  addCoreFnMal('vector?', t.createUnFunction(x => t.MalBool(t.isType(x, 'vector'))));

  addCoreFnMal('empty?', t.createUnFunction(isEmpty));
  addCoreFnMal('count', t.createUnFunction(count));

  addCoreFnMal('cons', t.createBinFunction(cons));
  addCoreFn('conj', conj);
  addCoreFn('concat', concat);

  addCoreFnMal('nth', t.createBinFunction(nth));
  addCoreFnMal('first', t.createUnFunction(first));
  addCoreFnMal('rest', t.createUnFunction(rest));

  addCoreFn('apply', apply);
  addCoreFnMal('map', t.createBinFunction(map));

  addCoreFnMal('sequential?', t.createUnFunction(x => t.MalBool(t.isSeqType(x))));
}

namespace cmp {
  function equals(a: t.MalType, b: t.MalType): boolean {
    const aVal = a.value;
    const bVal = b.value;
    if (t.isSeqType(a) && t.isSeqType(b)) {
      return aVal.length === bVal.length && aVal.every((elem: t.MalType, i: number) => equals(elem, bVal[i]));
    } else if (a.typeTag === b.typeTag) {
      return aVal === bVal;
    }

    return false;
  }

  function ge(a: t.MalNumber, b: t.MalNumber): t.MalBool {
    return t.MalBool(a.value >= b.value);
  }
  function le(a: t.MalNumber, b: t.MalNumber): t.MalBool {
    return t.MalBool(a.value <= b.value);
  }
  function gt(a: t.MalNumber, b: t.MalNumber): t.MalBool {
    return t.MalBool(a.value > b.value);
  }
  function lt(a: t.MalNumber, b: t.MalNumber): t.MalBool {
    return t.MalBool(a.value < b.value);
  }

  addCoreFnMal('=', t.createBinFunction((a, b) => t.MalBool(equals(a, b))));
  addCoreFnMal('<', t.createBinFunction(lt));
  addCoreFnMal('<=', t.createBinFunction(le));
  addCoreFnMal('>', t.createBinFunction(gt));
  addCoreFnMal('>=', t.createBinFunction(ge));
}

namespace io {
  function prStr(args: t.MalType[]): t.MalString {
    return t.MalString(args.map(x => printString(x, true)).join(' '));
  }
  function str(args: t.MalType[]): t.MalString {
    return t.MalString(args.map(x => printString(x, false)).join(''));
  }
  function prn(args: t.MalType[]) {
    console.log(prStr(args).value);
    return t.NIL;
  }
  function println(args: t.MalType[]) {
    console.log(args.map(x => printString(x, false)).join(' '));
    return t.NIL;
  }

  function slurp(fileName: t.MalString): t.MalString {
    return t.MalString(readFileSync(fileName.value, 'utf-8'));
  }

  addCoreFn('pr-str', prStr);
  addCoreFn('str', str);
  addCoreFn('prn', prn);
  addCoreFn('println', println);

  addCoreFnMal('read-string', t.createUnFunction(str => readString(str.value)));
  addCoreFnMal('slurp', t.createUnFunction(slurp));
}

namespace err {
  function throwErr(e: t.MalType): t.MalType {
    throw e;
  }

  addCoreFnMal('throw', t.createUnFunction(throwErr));
}

namespace map {
  function toMap(args: t.MalType[]): t.MalHashMap {
    const res: Map<string, t.MalType> = new Map();

    for (let i = 0; i < args.length - 1; i += 2) {
      res.set(args[i].value as string, args[i + 1]);
    }

    return t.MalHashMap(res);
  }
  function assoc(args: t.MalType[]): t.MalHashMap {
    const res = new Map((args[0] as t.MalHashMap).value.entries());

    for (let i = 1; i < args.length - 1; i += 2) {
      res.set(args[i].value as string, args[i + 1]);
    }

    return t.MalHashMap(res);
  }
  function dissoc(args: t.MalType[]): t.MalHashMap {
    const res = new Map((args[0] as t.MalHashMap).value.entries());

    for (let i = 1; i < args.length; i++) {
      res.delete((args[i] as t.MalString|t.MalKeyword).value);
    }

    return t.MalHashMap(res);
  }
  function getFrom(m: t.MalType, k: t.MalString|t.MalKeyword): t.MalType {
    return t.isType<t.MalHashMap>(m, 'hashmap') && m.value.has(k.value) ? m.value.get(k.value) : t.NIL;
  }
  function containsKey(m: t.MalHashMap, k: t.MalString|t.MalKeyword): t.MalBool {
    return t.MalBool(m.value.has(k.value));
  }
  function keys(m: t.MalHashMap): t.MalList {
    return t.MalList(Array.from(m.value.keys()).map(t.mapKeyFromString));
  }
  function vals(m: t.MalHashMap): t.MalList {
    return t.MalList(Array.from(m.value.values()));
  }

  addCoreFn('hash-map', toMap);
  addCoreFnMal('map?', t.createUnFunction(x => t.MalBool(t.isType(x, 'hashmap'))));
  addCoreFn('assoc', assoc);
  addCoreFn('dissoc', dissoc);
  addCoreFnMal('get', t.createBinFunction(getFrom));
  addCoreFnMal('contains?', t.createBinFunction(containsKey));
  addCoreFnMal('keys', t.createUnFunction(keys));
  addCoreFnMal('vals', t.createUnFunction(vals));
}

namespace meta {
  function withMeta(obj: t.HasMeta & t.MalType, meta: t.MalType): t.HasMeta & t.MalType {
    const res: any = Object.assign({}, obj);
    res[t.MAL_META] = meta;

    return res;
  }
  function meta(obj: t.HasMeta): t.MalType {
    return (obj as any)[t.MAL_META] || t.NIL as t.MalType;
  }

  addCoreFnMal('with-meta', t.createBinFunction(withMeta));
  addCoreFnMal('meta', t.createUnFunction(meta));
}

namespace atom {
  function reset(a: t.MalAtom, val: t.MalType): typeof val {
    a.value = val;
    return val;
  }
  function swap(args: t.MalType[]): t.MalType {
    const a = args[0];
    const func = args[1].value;
    const rest = args.slice(2);
    return reset(a, func([a.value].concat(rest)));
  }

  addCoreFnMal('atom', t.createUnFunction(t.MalAtom));
  addCoreFnMal('atom?', t.createUnFunction(x => t.MalBool(t.isType(x, 'atom'))));
  addCoreFnMal('deref', t.createUnFunction((x: t.MalAtom) => x.value));
  addCoreFnMal('reset!', t.createBinFunction(reset));
  addCoreFn('swap!', swap);
}

addCoreFnMal('nil?', t.createUnFunction(x => t.MalBool(x === t.NIL)));
addCoreFnMal('true?', t.createUnFunction(x => t.MalBool(x === t.TRUE)));
addCoreFnMal('false?', t.createUnFunction(x => t.MalBool(x === t.FALSE)));

addCoreFnMal('symbol', t.createUnFunction(s => t.MalSymbol(s.value)));
addCoreFnMal('symbol?', t.createUnFunction(x => t.MalBool(t.isType(x, 'symbol'))));

addCoreFnMal('keyword', t.createUnFunction(kw => t.isType(kw, 'keyword') ? kw : t.MalKeyword(kw.value)));
addCoreFnMal('keyword?', t.createUnFunction(x => t.MalBool(t.isType(x, 'keyword'))));

addCoreFnMal('readline', t.createUnFunction(s => t.MalString(readline(s.value))));

export default coreNS;
