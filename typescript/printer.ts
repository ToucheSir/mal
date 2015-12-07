'use strict';
import {
    isType,
    KEYWORD_PREFIX,
    MalType,
    MalNumber,
    MalSymbol,
    MalList,
    MalString,
    MalBool,
    MalKeyword,
    MalVector,
    MalHashMap,
    MalFunction,
    MalAtom
} from './types';
import {map, join} from './itertools';

function printHashMap(m: Map<string, MalType>, readable?: boolean) {
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

export function printString(obj: MalType, readable?: boolean): string {
  if (isType<MalNumber>(obj, 'number')) {
    return String(obj.value);
  } else if (isType<MalSymbol>(obj, 'symbol')) {
    return Symbol.keyFor(obj.value);
  } else if (isType<MalList>(obj, 'list')) {
    return `(${(obj as MalList).value.map(x => printString(x, !!readable)).join(' ')})`;
  } else if (isType<MalType>(obj, 'nil')) {
    return 'nil';
  } else if (isType<MalString>(obj, 'string')) {
    if (readable) {
      return `"${malEscapeStr(obj.value)}"`;
    }
    return obj.value;
  } else if (isType<MalBool>(obj, 'bool')) {
    return String(obj.value);
  } else if (isType<MalKeyword>(obj, 'keyword')) {
    return ':' + obj.value.slice(1);
  } else if (isType<MalVector>(obj, 'vector')) {
    return `[${obj.value.map(x => printString(x, !!readable)).join(' ')}]`;
  } else if (isType<MalHashMap>(obj, 'hashmap')) {
    return printHashMap(obj.value, !!readable);
  } else if (isType<MalFunction>(obj, 'function')) {
    return '#<function>';
  } else if (isType<MalAtom>(obj, 'atom')) {
    return `(atom ${printString(obj.value)})`;
  } else {
    return String(obj.value);
  }
}
