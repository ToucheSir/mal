'use strict';
import {Env} from './env.ts';

export const MAL_META = Symbol('mal.has-meta');

export interface IMalType<T> {
  typeTag: string;
  value: T
}
export type MalType = IMalType<any>;

export interface HasMeta {
  //meta?: MalType;
}

export interface MalSeq extends IMalType<MalType[]>, HasMeta {
}
export interface MalList extends MalSeq {
}
export interface MalVector extends MalSeq {
}

export interface MalHashMap extends IMalType<Map<string, MalType>>, HasMeta {
}

export interface MalNumber extends IMalType<number> {
}

export interface MalSymbol extends IMalType<symbol>, HasMeta {
}

export const NIL: MalType = {typeTag: 'nil', value: null};

export interface MalString extends IMalType<string> {
}
export interface MalKeyword extends IMalType<string> {
}

export interface MalBool extends IMalType<boolean> {
}

export interface MalFunction extends IMalType<(args: MalType[]) => MalType> {
  ast?: MalType;
  params?: symbol[];
  env?: Env;
  isMacro: boolean;
}

export interface MalAtom extends IMalType<MalType> {
}

export function isType<T extends MalType>(m: MalType, typeStr: string): m is T {
  return m.typeTag === typeStr;
}

export function isSeqType(m: MalType): m is MalSeq {
  return m.typeTag === 'vector' || m.typeTag === 'list';
}
export function MalNumber(n: number): MalNumber {
  return {typeTag: 'number', value: n};
}

export function MalSymbol(str: string): MalSymbol {
  return {typeTag: 'symbol', value: Symbol.for(str)};
}

export function MalString(str: string): MalString {
  return {typeTag: 'string', value: str};
}

export const TRUE = {typeTag: 'bool', value: true};
export const FALSE = {typeTag: 'bool', value: false};
export function MalBool(bool: boolean): MalBool {
  return bool ? TRUE : FALSE;
}

export function MalList(arr: MalType[]): MalList {
  return {typeTag: 'list', value: arr};
}

export function MalVector(arr: MalType[]): MalVector {
  return {typeTag: 'vector', value: arr};
}

export function MalHashMap(map: Map<string, MalType>): MalHashMap {
  return {typeTag: 'hashmap', value: map};
}
export function mapKeyFromString(k: string): MalString|MalKeyword {
  return k[0] === KEYWORD_PREFIX ? MalKeyword(k.slice(1)) : MalString(k);
}

export const KEYWORD_PREFIX = '\u029E';

export function MalKeyword(str: string): MalKeyword {
  return {typeTag: 'keyword', value: KEYWORD_PREFIX + str};
}

export function MalFunction(fn: (args: MalType[]) => MalType): MalFunction {
  return {typeTag: 'function', value: fn, isMacro: false};
}

export function MalAtom(val: MalType): MalAtom {
  return {typeTag: 'atom', value: val};
}

export function createUnFunction<T1 extends MalType, R extends MalType>
(fn: (a1: T1) => R): MalFunction {
  return MalFunction((args: MalType[]) => fn(args[0] as T1));
}

export function createBinFunction<T1 extends MalType, T2 extends MalType, R extends MalType>
(fn: (a1: T1, a2: T2) => R): MalFunction {
  return MalFunction((args: MalType[]) => fn(args[0] as T1, args[1] as T2));
}

