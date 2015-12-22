'use strict';
interface CurriedFunction2<T1, T2, R> {
  (t1: T1): (t2: T2) => R;
  (t1: T1, t2: T2): R;
}

function curry2<T1, T2, R>(f: (t1: T1, t2: T2) => R): CurriedFunction2<T1, T2, R> {
  function curriedFunction(t1: T1): (t2: T2) => R;
  function curriedFunction(t1: T1, t2: T2): R;
  function curriedFunction(t1: T1, t2?: T2): any {
    if (t2 === undefined) {
      return (t2: T2) => f(t1, t2);
    } else {
      return f(t1, t2);
    }
  }

  return curriedFunction;
}

export const join = curry2((delim: string, args?: Iterable<any>) => {
  return Array.from(args).join(delim);
});

export const findMatches = curry2(function*(delim: RegExp, str: string) {
  let group: string;
  while ((group = delim.exec(str)[1]) !== '') {
    yield group;
  }
  delim.lastIndex = 0;
});

export function* map<A,B>(fn: (arg: A) => B, iter: Iterable<A>) {
  for (const elem of iter) {
    yield fn(elem);
  }
}

export function* interpose<A,B>(arg: A, iter: Iterable<B>): IterableIterator<any> {
  const items = iter[Symbol.iterator]();
  let elem: IteratorResult<B>;

  if (!(elem = items.next()).done) {
    yield elem.value;
  }

  for (elem = items.next(); !elem.done; elem = items.next()) {
    yield arg;
    yield elem.value;
  }
}

