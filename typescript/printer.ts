'use strict';
import {
    KEYWORD_PREFIX,
    MalType,
    MalList,
    MalVector,
    MalHashMap,
    MalFunction,
    MalAtom,
    isSymbol,
    isNumber,
    isSequential,
    isList,
    NIL,
    isString,
    isBoolean,
    isMap,
    isFunction,
    isAtom,
    isVector,
    isKeyword,
    MalSeq
} from './types';
import {map, join} from './itertools';

function printHashMap(m: MalHashMap, readable?: boolean) {
  return `{${join(' ', map(kv => joinEntry(kv, !!readable), m))}}`;
}

function joinEntry(kv: [string, MalType], readable?: boolean): string {
  if (kv[0][0] === KEYWORD_PREFIX) {
    kv[0] = ':' + kv[0].slice(1);
  } else {
    kv[0] = `"${kv[0]}"`;
  }
  return `${kv[0]} ${printString(kv[1], !!readable)}`;
}

function malEscapeStr(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

const LIST_BRACES: [string, string] = ['(', ')'];
const VECTOR_BRACES: [string, string] = ['[', ']'];
export function printSeq(s: MalSeq, braces: [string, string], readable?: boolean): string {
  return braces[0] + s.map<string>(x => printString(x, !!readable)).join(' ') + braces[1];
}

export function printString(obj: MalType, readable?: boolean): string {
  if (isNumber(obj) || isBoolean(obj)) {
    return String(obj);
  } else if (isSymbol(obj)) {
    return Symbol.keyFor(obj);
  } else if (isVector(obj)) {
    return printSeq(obj, VECTOR_BRACES, !!readable);
  } else if (isList(obj)) {
    return printSeq(obj, LIST_BRACES, !!readable);
  } else if (obj === NIL) {
    return 'nil';
  } else if (isString(obj)) {
    if (isKeyword(obj)) {
      return ':' + obj.slice(1);
    }

    if (readable) {
      return `"${malEscapeStr(obj)}"`;
    }
    return obj;
  } else if (isMap(obj)) {
    return printHashMap(obj, !!readable);
  } else if (isFunction(obj)) {
    return '#<function>';
  } else if (isAtom(obj)) {
    return `(atom ${printString(obj.value)})`;
  } else {
    throw new Error('unknown type');
  }
}
