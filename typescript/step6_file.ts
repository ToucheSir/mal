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
    MalString,
    MalBool,
    NIL,
    createUnFunction
} from './types';
import {Env} from './env';
import coreNS from './core';
import {map} from './itertools';

function READ(str: string) {
  return readString(str);
}

function EVAL(form: MalType, env: Env): MalType {
  while (true) {
    if (!isType<MalList>(form, 'list')) {
      return evalAst(form, env);
    } else {
      let sym = form.value[0];
      const rest = form.value.slice(1);
      if (!isType<MalSymbol>(sym, 'symbol')) {
        sym = MalSymbol(':default');
      }

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
          form = rest[1];
          env = letEnv;
          break;
        case 'do':
          evalAst(MalList(rest.slice(0, -1)), env);
          form = rest.pop();
          break;
        case 'if':
          const cond = EVAL(rest[0], env);

          if (cond === NIL || cond.value === false) {
            form = rest[2] || NIL;
          } else {
            form = rest[1];
          }
          break;
        case 'fn*':
          const binds = (rest[0] as MalList).value.map(v => v.value);
          const closure = MalFunction((args: MalType[]) => {
            const fnEnv = new Env(env, binds, args);

            return EVAL(rest[1], fnEnv);
          });
          closure.ast = rest[1];
          closure.params = binds;
          closure.env = env;
          return closure;
        default:
          const newForm = evalAst(form, env) as MalList;
          const func = (newForm.value[0] as MalFunction);
          const args = newForm.value.slice(1);
          // check if mal-hosted
          if (!func.ast) {
            return func.value(args);
          } else {
            form = func.ast;
            env = new Env(func.env, func.params, args);
            break;
          }
      }
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
  return printString(obj, true);
}

const replEnv = new Env(null);
for (const kv of coreNS) {
  replEnv.set(kv[0], kv[1]);
}
replEnv.set(MalSymbol('eval').value, createUnFunction(ast => EVAL(ast, replEnv)));
replEnv.set(MalSymbol('*ARGV*').value, MalList(process.argv.slice(2).map(MalString)));

function rep(str: string) {
  return PRINT(EVAL(READ(str), replEnv));
}

// initialize repl functions
rep('(def! not (fn* (a) (if a false true)))');
rep('(def! load-file (fn* (f) (eval (read-string (str "(do " (slurp f) ")")))))');
while (true) {
  const line = readline('user> ');
  try {
    console.log(rep(line));
  } catch (err) {
    console.log(err.message);
  }
}
