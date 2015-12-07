'use strict';
import {readline} from './node_readline';
import {readString} from './reader';
import {printString} from './printer';
import {MalType, isType, MalList, MalVector, MalHashMap, MalSymbol, MalFunction} from './types';
import {replEnv} from './env';
import {map} from './itertools';

function READ(str: string) {
  return readString(str);
}

function EVAL(form: MalType) {
  if (!isType<MalList>(form, 'list')) {
    return evalAst(form);
  } else {
    const newForm = evalAst(form) as MalList;
    const func = newForm.value[0] as MalFunction;
    return func.call(newForm.value.slice(1));
  }
}

function evalEntry(entry: [string, MalType]): [string, MalType] {
  return [entry[0], EVAL(entry[1])];
}
function evalAst(expr: MalType): MalType {
  if (isType<MalSymbol>(expr, 'symbol')) {
    return replEnv.get(expr.value);
  } else if (isType<MalList>(expr, 'list')) {
    return MalList(expr.value.map(EVAL));
  } else if (isType<MalVector>(expr, 'vector')) {
    return MalVector(expr.value.map(EVAL));
  } else if (isType<MalHashMap>(expr, 'hashmap')) {
    const mappedEntries = map(evalEntry, expr.value);
    return MalHashMap(new Map(mappedEntries));
  } else {
    return expr;
  }
}

function PRINT(obj: MalType) {
  return printString(obj);
}

function rep(str: string) {
  return PRINT(EVAL(READ(str)));
}

//rep('[1 2 (+ 1 2)]');
while (true) {
  const line = readline('user> ');
  try {
    console.log(rep(line));
  } catch (err) {
    console.log(err.message);
  }
}
