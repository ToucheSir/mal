'use strict';
import {readline} from './node_readline';
import {readString} from './reader';
import {printString} from './printer';
import {
    MalType,
    isType,
    MalList,
    MalVector,
    MalHashMap,
    MalSymbol,
    MalFunction,
    MalBool,
    NIL
} from './types';
import {Env} from './env';
import coreNS from './core';
import {map} from './itertools';

function READ(str: string) {
  return readString(str);
}

function deferEval(env: Env) {
  return (ast: MalType) => EVAL(ast, env);
}

function EVAL(form: MalType, env: Env): MalType {
  if (!isType<MalList>(form, 'list')) {
    return evalAst(form, env);
  } else {
    const sym = form.value[0];
    const rest = form.value.slice(1);
    if (isType<MalSymbol>(sym, 'symbol')) {
      switch (Symbol.keyFor(sym.value)) {
        case 'def!':
          const key = (rest[0] as MalSymbol).value;
          return env.set(key, EVAL(rest[1], env));
        case 'let*':
          const letEnv = new Env(env);
          const bindings = (rest[0] as MalList).value;
          for (let i = 0; i < bindings.length; i += 2) {
            const declPair = bindings.slice(i, i + 2);
            const identifierSym = (declPair[0] as MalSymbol).value;
            letEnv.set(identifierSym, EVAL(declPair[1], letEnv));
          }
          return EVAL(rest[1], letEnv);
        case 'do':
          return rest.map(deferEval(env)).pop();
        case 'if':
          const cond = EVAL(rest[0], env);

          if (cond === NIL || cond.value === false) {
            return rest[2] === undefined ? NIL : EVAL(rest[2], env);
          } else {
            return EVAL(rest[1], env);
          }
        case 'fn*':
          return MalFunction((args: MalType[]) => {
            const binds = (rest[0] as MalList).value.map(v => v.value);
            const fnEnv = new Env(env, binds, args);

            return EVAL(rest[1], fnEnv);
          });
        default:
          break;
      }
    }
    const newForm = evalAst(form, env) as MalList;
    const func = (newForm.value[0] as MalFunction).value;
    return func(newForm.value.slice(1));
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
  return printString(obj, true);
}

const replEnv = new Env(null);
for (const kv of coreNS) {
  replEnv.set(kv[0], kv[1]);
}
function rep(str: string) {
  return PRINT(EVAL(READ(str), replEnv));
}

// initialize repl functions
rep('(def! not (fn* (a) (if a false true)))');
while (true) {
  const line = readline('user> ');
  try {
    console.log(rep(line));
  } catch (err) {
    console.log(err.message);
  }
}
