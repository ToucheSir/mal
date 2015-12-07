import {MalKeyword} from "./types";
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
    createUnFunction,
    isSeqType
} from './types';
import {Env} from './env';
import coreNS from './core';
import {map} from './itertools';

function isPair(l: MalType): boolean {
  return isSeqType(l) && l.value.length > 0;
}

function quasiquote(form: MalType): MalType {
  if (!isPair(form)) {
    return MalList([MalSymbol('quote'), form]);
  } else if (form.value[0].value === Symbol.for('unquote')) {
    return form.value[1];
  } else if (isPair(form.value[0]) && form.value[0].value[0].value === Symbol.for('splice-unquote')) {
    return MalList([MalSymbol('concat'), form.value[0].value[1], quasiquote(MalList(form.value.slice(1)))]);
  } else {
    return MalList([MalSymbol('cons'), quasiquote(form.value[0]), quasiquote(MalList(form.value.slice(1)))])
  }
}

function READ(str: string) {
  return readString(str);
}

function isMacroCall(ast: MalType, env: Env): boolean {
  if (isType<MalList>(ast, 'list')) {
    const sym = ast.value[0] as MalSymbol;
    const foundEnv = env.find(sym.value);

    if (!foundEnv) {
      return false;
    }
    const func = foundEnv.get(sym.value);
    return isType<MalFunction>(func, 'function') && func.isMacro;
  }
  return false;
}

function macroexpand(ast: MalType, env: Env): MalType {
  while (isMacroCall(ast, env)) {
    const sym = ast.value[0] as MalSymbol;
    const macroFunc = env.get(sym.value) as MalFunction;
    ast = macroFunc.value(ast.value.slice(1));
  }

  return ast;
}

function EVAL(ast: MalType, env: Env): MalType {
  while (true) {
    if (!isType<MalList>(ast, 'list')) {
      return evalAst(ast, env);
    } else {
      ast = macroexpand(ast, env);
      if (!isType<MalList>(ast, 'list')) {
        return ast;
      }

      let sym = ast.value[0];
      const rest = ast.value.slice(1);
      if (!isType<MalSymbol>(sym, 'symbol')) {
        sym = MalSymbol(':default');
      }

      switch (Symbol.keyFor(sym.value)) {
        case 'def!':
          const key = (rest[0] as MalSymbol).value;
          return env.set(key, EVAL(rest[1], env));
        case 'defmacro!':
          const macroFunc = EVAL(rest[1], env) as MalFunction;
          macroFunc.isMacro = true;
          return env.set(rest[0].value, macroFunc);
        case 'macroexpand':
          return macroexpand(rest[0], env);
        case 'let*':
          const letEnv = new Env(env);
          const bindings = (rest[0] as MalList).value;
          for (let i = 0; i < bindings.length; i += 2) {
            const declPair = bindings.slice(i, i + 2);
            const identifierSym = (declPair[0] as MalSymbol).value;
            letEnv.set(identifierSym, EVAL(declPair[1], letEnv));
          }
          ast = rest[1];
          env = letEnv;
          break;
        case 'do':
          evalAst(MalList(rest.slice(0, -1)), env);
          ast = rest.pop();
          break;
        case 'if':
          const cond = EVAL(rest[0], env);

          if (cond === NIL || cond.value === false) {
            ast = rest[2] || NIL;
          } else {
            ast = rest[1];
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
        case 'quote':
          return rest[0];
        case 'quasiquote':
          ast = quasiquote(rest[0]);
          break;
        default:
          const evaluated = evalAst(ast, env) as MalList;
          const func = (evaluated.value[0] as MalFunction);
          const args = evaluated.value.slice(1);
          // check if mal-hosted
          if (!func.ast) {
            return func.value(args);
          } else {
            ast = func.ast;
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

function rep(str: string) {
  return PRINT(EVAL(READ(str), replEnv));
}

// initialize repl functions
rep('(def! not (fn* (a) (if a false true)))');
rep('(def! load-file (fn* (f) (eval (read-string (str "(do " (slurp f) ")")))))');

rep(`
(defmacro! cond (fn* (& xs)
  (if (> (count xs) 0)
    (list 'if (first xs)
      (if (> (count xs) 1)
        (nth xs 1)
        (throw "odd number of forms to cond"))
      (cons 'cond (rest (rest xs)))))))
`);
rep(`
(defmacro! or (fn* (& xs)
  (if (empty? xs)
    nil
    (if (= 1 (count xs))
      (first xs)
      \`(let* (or_FIXME ~(first xs))
          (if or_FIXME
            or_FIXME
            (or ~@(rest xs))))))))
`);
if (process.argv && process.argv.length > 2) {
  rep(`(load-file "${process.argv[2]}")`);
  replEnv.set(MalSymbol('*ARGV*').value, MalList(process.argv.slice(3).map(MalString)));
}

const running = true;
while (running) {
  const line = readline('user> ');
  try {
    console.log(rep(line));
  } catch (err) {
    console.log(err.message);
  }
}
