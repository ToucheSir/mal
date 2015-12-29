'use strict';
import {Env} from './env.ts';

export const MAL_META = Symbol('mal.has-meta');
export const IS_VECTOR = Symbol('mal.is-vector');
export const KEYWORD_PREFIX = '\u029e';

export type MalType = number|string|boolean|symbol|MalFunction|MalSeq|MalMap|MalAtom|MalKeyword;

export const NIL: MalType = null;

export interface HasMeta {
  //meta?: MalType;
}

export interface MalSeq extends HasMeta {
  first(): MalType;
  last(): MalType;
  rest(): MalList;
  butLast(): MalType;
  nth(index: number): MalType;
  cons(elem: MalType): MalList;
  concat(seq: MalSeq): MalList;
  conj(...args: MalType[]): MalSeq;
  length: number;
  [Symbol.iterator](): Iterator<MalType>;
  equals(seq: MalSeq, cmpFn?: (a: MalType, b: MalType) => boolean): boolean;
  clone(): this;
}

export class MalVector implements MalSeq, HasMeta {
  private arr: MalType[];

  static of(...args: MalType[]): MalVector {
    return new MalVector(...args);
  }

  constructor(...args: MalType[]) {
    this.arr = args;
  }

  first() {
    return this.arr.length > 0 ? this.arr[0] : NIL;
  }

  last() {
    return this.arr.length > 0 ? this.arr[this.arr.length - 1] : NIL;
  }

  rest() {
    return new MalList(...this.arr.slice(1));
  }

  butLast() {
    return new MalList(...this.arr.slice(0, -1));
  }

  nth(index: number) {
    if (index < 0 || index >= this.length) {
      throw new Error(`index ${index} out of bounds`);
    }
    return this.arr[index];
  }

  get length() {
    return this.arr.length;
  }

  concat(seq: MalSeq) {
    return new MalList(...this.arr, ...seq);
  }

  cons(elem: MalType) {
    return new MalList(elem, ...this.arr);
  }

  conj(...args: MalType[]) {
    return new MalVector(...this.arr, ...args);
  }

  equals(seq: MalSeq, cmpFn?: (a: MalType, b: MalType) => boolean) {
    if (this.length !== seq.length) {
      return false;
    } else if (this.arr.length === 0) {
      return true;
    }

    let i = 0;
    for (const elem of seq) {
      if (!(cmpFn || Object.is)(elem, this.arr[i++])) {
        return false;
      }
    }

    return true;
  }

  [Symbol.iterator]() {
    return this.arr[Symbol.iterator]();
  }

  clone() {
    const cloned = Object.assign(new MalVector(), this);
    return cloned;
  }
}

type ListNode = {
  val?: MalType;
  next?: ListNode;
};

export class MalList implements MalSeq, HasMeta {
  length: number = 0;
  private head: ListNode = null;
  private tail: ListNode = null;

  static of(...args: MalType[]): MalList {
    return new MalList(...args);
  }

  constructor(...args: MalType[]) {
    for (const elem of args) {
      this.addMut(elem);
    }
  }

  private addMut(elem: MalType): void {
    const toAdd = {val: elem};
    if (!this.head) {
      this.head = toAdd;
      this.tail = this.head;
    } else {
      this.tail.next = toAdd;
      this.tail = toAdd;
    }
    this.length++;
  }

  private addMutFront(elem: MalType): void {
    this.head = {val: elem, next: this.head};
    if (!this.tail) {
      this.tail = this.head;
    }
    this.length++;
  }

  first() {
    return this.length > 0 ? this.head.val : NIL;
  }

  last() {
    return this.length > 0 ? this.tail.val : NIL;
  }

  rest() {
    const restList = new MalList();
    if (this.head) {
      restList.head = this.head.next;
      if (this.head !== this.tail) {
        restList.tail = this.tail;
      }
      restList.length = this.length - 1;
    }
    return restList;
  }

  butLast() {
    const upToTail = new MalList();
    for (let current = this.head; current && current !== this.tail; current = current.next) {
      upToTail.addMut(current.val);
    }

    return upToTail;
  }

  nth(index: number) {
    if (index < 0 || index >= this.length) {
      throw new Error(`list index ${index} out of bounds`);
    }
    let current = this.head;
    for (let i = 0; i < index && current.next; i++) {
      current = current.next;
    }

    return current.val;
  }

  cons(elem: MalType) {
    const withNewElem = new MalList(...this);
    withNewElem.addMutFront(elem);
    return withNewElem;
    //return this.conj(elem);
  }

  concat(seq: MalSeq) {
    const res = new MalList(...this, ...seq);
    return res;
  }

  conj(...args: MalType[]) {
    const res = new MalList();
    if (this.head) {
      res.head = {val: this.head.val, next: this.head.next};
      res.tail = this.tail;
    }
    res.length += this.length;

    for (const arg of args) {
      res.addMutFront(arg);
    }

    return res;
  }

  *[Symbol.iterator]() {
    for (let current = this.head; current; current = current.next) {
      yield current.val;
    }
  }

  equals(seq: MalSeq, cmpFn?: (a: MalType, b: MalType) => boolean) {
    if (this.length !== seq.length) {
      return false;
    } else if (this.length === 0) {
      return true;
    }

    let current = this.head;
    for (const elem of seq) {
      if (!(cmpFn || Object.is)(elem, current.val)) {
        console.log(elem, current.val, '<>', cmpFn(elem, current.val));
        return false;
      }

      current = current.next;
    }

    return true;
  }

  clone() {
    const cloned = Object.assign(new MalList(), this);
    return cloned;
  }
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
  call: (thisArg: any, ...args: MalType[]) => MalType;
}
export function createMalFunction(fn: (...args: MalType[]) => MalType, ast?: MalType, params?: symbol[], env?: Env) {
  return {
    fn, ast, params, env,
    isMacro: false,
    call: fn.call
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
export function isKeyword(m: MalType): m is MalKeyword {
  return m instanceof MalKeyword;
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
  return m instanceof MalList || m instanceof MalVector || Array.isArray(m);
}
export function isList(m: MalType): m is MalList {
  return m instanceof MalList;
}

export function isVector(m: MalType): m is MalVector {
  return m instanceof MalVector;
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

export function objToKey(k: MalType): string {
  if (isString(k)) {
    return k;
  } else if (isKeyword(k)) {
    return k.toStringKey();
  }

  throw new Error('can not use this type as a map key');
}
export function createKeyword(s: string): MalKeyword {
  return new MalKeyword(s);
}

export class MalKeyword {
  constructor(private val: string) {
    this.val = val;
  }

  toString() {
    return ':' + this.val;
  }

  toStringKey() {
    return KEYWORD_PREFIX + this.val;
  }

}
