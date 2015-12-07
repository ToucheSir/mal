'use strict';
import {readline} from './node_readline';
import {readString} from './reader';
import {printString} from './printer';
import {MalType, isType, MalList, MalVector, MalHashMap, MalSymbol, MalFunction} from './types';
import {Env, replEnv} from './env';
import {map} from './itertools';

function READ(str: string) {
  return readString(str);
}

function EVAL(form: MalType, env: Env): MalType {
  if (!isType<MalList>(form, 'list')) {
    return evalAst(form, env);
  } else {
    const sym = form.value[0] as MalSymbol;
    switch (Symbol.keyFor(sym.value)) {
      case 'def!':
        const key = (form.value[1] as MalSymbol).value;
        return env.set(key, EVAL(form.value[2], env));
      case 'let*':
        const letEnv = new Env(env);
        const bindings = (form.value[1] as MalList).value;
        for (let i = 0; i < bindings.length; i += 2) {
          const declPair = bindings.slice(i, i + 2);
          const identifierSym = (declPair[0] as MalSymbol).value;
          letEnv.set(identifierSym, EVAL(declPair[1], letEnv));
        }
        return EVAL(form.value[2], letEnv);
      default:
        const newForm = evalAst(form, env) as MalList;
        const func = newForm.value[0] as MalFunction;
        return func.call(newForm.value.slice(1));
    }
  }
}

function evalAst(expr: MalType, env: Env): MalType {
  if (isType<MalSymbol>(expr, 'symbol')) {
    return env.get(expr.value);
  } else if (isType<MalList>(expr, 'list')) {
    return MalList(expr.value.map((exp) => EVAL(exp, env)));
  } else if (isType<MalVector>(expr, 'vector')) {
    return MalVector(expr.value.map((exp) => EVAL(exp, env)));
  } else if (isType<MalHashMap>(expr, 'hashmap')) {
    const mappedEntries = map(function (kv: [string, MalType]): [string, MalType] {
      return [kv[0], EVAL(kv[1], env)];
    }, expr.value);
    return MalHashMap(new Map(mappedEntries));
  } else {
    return expr;
  }
}

function PRINT(obj: MalType) {
  return printString(obj);
}

function rep(str: string) {
  return PRINT(EVAL(READ(str), replEnv));
}

rep('(def! a 4)');
rep('(let* (z 2) (let* (q 9) a))');
while (true) {
  const line = readline('user> ');
  try {
    console.log(rep(line));
  } catch (err) {
    console.log(err.message);
  }
}
