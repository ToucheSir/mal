'use strict';
import {Env} from './env.ts';

export const MAL_META = Symbol('mal.has-meta');
export const IS_VECTOR = Symbol('mal.is-vector');
export const KEYWORD_PREFIX = '\u029e';

export type MalType = number|string|boolean|symbol|MalFunction|MalSeq|MalMap|MalAtom;

export const NIL: MalType = null;

export interface HasMeta {
  //meta?: MalType;
}

export interface MalSeq extends Array<MalType>, HasMeta {

}
export interface MalList extends MalSeq {
}
export interface MalVector extends MalSeq {
}

export interface MalMap extends Map<string, MalType>, HasMeta {
}
export interface MalHashMap extends MalMap {

}

export interface MalFunction extends HasMeta {
  fn: (...args: MalType[]) => MalType;
  ast?: MalType;
  env?: Env;
  params?: symbol[];
  isMacro: boolean;
}
export function createMalFunction(fn: (...args: MalType[]) => MalType, ast?: MalType, params?: symbol[], env?: Env) {
  return {
    fn, ast, params, env,
    isMacro: false
  };
}

export interface MalAtom {
  value: MalType;
}

export function isNumber(m: MalType): m is number {
  return typeof m === 'number';
}
export function isString(m: MalType): m is string {
  return typeof m === 'string';
}
export function isKeyword(m: MalType): m is string {
  return isString(m) && m[0] === KEYWORD_PREFIX;
}
export function mapKeyFromString(s: string): string {
  console.log(s);
  return s[0] === ':' ? createKeyword(s.slice(1)) : s;
}

export function isBoolean(m: MalType): m is boolean {
  return typeof m === 'boolean';
}
export function isSymbol(m: MalType): m is symbol {
  return typeof m === 'symbol';
}
export function isFunction(m: MalType): m is MalFunction {
  return m.hasOwnProperty('fn');
}
export function isMap(m: MalType): m is MalMap {
  return m instanceof Map;
}
export function isSequential(m: MalType): m is MalSeq {
  return Array.isArray(m);
}
export function isList(m: MalType): m is MalList {
  return Array.isArray(m);
}

export function isVector(m: MalType): m is MalVector {
  return isSequential(m) && (m as any)[IS_VECTOR] === true;
}
export function isAtom(m: MalType): m is MalAtom {
  return m.hasOwnProperty('value');
}
export function createAtom(val: MalType): MalAtom {
  return {value: val};
}

export function createSymbol(s: string): symbol {
  return Symbol.for(s);
}
export function createVector(l: MalSeq) {
  const res = l.slice();
  (res as any)[IS_VECTOR] = true;
  return res;
}

export function createKeyword(s: string) {
  return KEYWORD_PREFIX + s;
}

