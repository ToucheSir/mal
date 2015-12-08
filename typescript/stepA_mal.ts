'use strict';
import {readline} from './node_readline';
import {readString} from './reader';
import {printString} from './printer';
import {
    MalType,
    createSymbol,
    createKeyword,
    MalFunction,
    MalList,
    MalSeq,

    createVector,
    createMalFunction,
    MalHashMap,
    NIL,
    isSequential,
    isList,
    isVector,
    isMap,
    isSymbol,
    isFunction
} from './types';
import {Env} from './env';
import coreNS from './core';
import {map} from './itertools';

function isPair(l: MalType): l is MalList {
  return isSequential(l) && l.length > 0;
}

function quasiquote(form: MalType): MalType {
  const firstElem = (form as MalSeq)[0];
  if (!isPair(form)) {
    return [createSymbol('quote'), form];
  } else if (firstElem === Symbol.for('unquote')) {
    return form[1];
  } else if (isPair(firstElem) && firstElem[0] === Symbol.for('splice-unquote')) {
    return [createSymbol('concat'), firstElem[1], quasiquote(form.slice(1))];
  } else {
    return [createSymbol('cons'), quasiquote(firstElem as MalSeq), quasiquote(form.slice(1))]
  }
}

function READ(str: string) {
  return readString(str);
}

function isMacroCall(ast: MalType, env: Env): boolean {
  if (isSequential(ast)) {
    const sym = ast[0];
    if (isSymbol(sym)) {
      const foundEnv = env.find(sym);
      if (foundEnv) {
        const func = foundEnv.get(sym);
        return isFunction(func) && func.isMacro;
      }
    }
  }
  return false;
}

function macroexpand(ast: MalType, env: Env): MalType {
  while (isMacroCall(ast, env)) {
    const sym = (ast as MalSeq)[0] as symbol;
    const macroFunc = env.get(sym) as MalFunction;
    //console.log('before:expand=', printString(ast, true));
    ast = macroFunc.fn(...(ast as MalSeq).slice(1));
    //console.log('after:expand=', printString(ast, true));
  }

  return ast;
}

function EVAL(ast: MalType, env: Env): MalType {
  while (true) {
    if (isVector(ast) || !isList(ast)) {
      return evalAst(ast, env);
    } else {
      ast = macroexpand(ast, env);
      if (!isList(ast)) {
        return ast;
      }
      let sym = (ast as MalSeq)[0];
      const rest = (ast as MalSeq).slice(1);
      if (!isSymbol(sym)) {
        sym = createSymbol(':default');
      }

      switch (Symbol.keyFor(sym as symbol)) {
        case 'def!':
          const key = rest[0] as symbol;
          return env.set(key, EVAL(rest[1], env));
        case 'defmacro!':
          const macroFunc = EVAL(rest[1], env) as MalFunction;
          macroFunc.isMacro = true;
          return env.set(rest[0] as symbol, macroFunc);
        case 'macroexpand':
          return macroexpand(rest[0], env);
        case 'try*':
          try {
            return EVAL(rest[0], env);
          } catch (e) {
            const catchClause = rest[1] as MalList;
            /*            const malExcept = MalHashMap(new Map([
             [MalKeyword('name'), MalString(e.name)],
             [MalKeyword('message'), MalString(e.message)],
             [MalKeyword('stack'), MalString(e.stack)]
             ]));*/
            const exceptSym = catchClause[1] as symbol;
            const exceptVal = e instanceof Error ? e.message : e;
            const catchEnv = new Env(env, [exceptSym], [exceptVal]);

            return EVAL(catchClause[2], catchEnv);
          }
        case 'let*':
          const letEnv = new Env(env);
          const bindings = (rest[0] as MalList);
          for (let i = 0; i < bindings.length; i += 2) {
            const declPair = bindings.slice(i, i + 2);
            const identifierSym = declPair[0] as symbol;
            letEnv.set(identifierSym, EVAL(declPair[1], letEnv));
          }
          ast = rest[1] as MalType;
          env = letEnv;
          break;
        case 'do':
          evalAst(rest.slice(0, -1), env);
          ast = rest[rest.length - 1];
          break;
        case 'if':
          const cond = EVAL(rest[0], env);

          if (cond === NIL || cond === false) {
            ast = rest[2] || NIL;
          } else {
            ast = rest[1];
          }
          break;
        case 'fn*':
          const binds = rest[0] as symbol[];
          return createMalFunction((...args: MalType[]) => {
            const fnEnv = new Env(env, binds, args);

            return EVAL(rest[1], fnEnv);
          }, rest[1], binds, env);
        case 'quote':
          return rest[0];
        case 'quasiquote':
          ast = quasiquote(rest[0]);
          break;
        default:
          const evaluated = evalAst(ast, env) as MalList;
          const func = (evaluated[0] as MalFunction);
          const args = evaluated.slice(1);

          //console.log('before:eval=', printString(ast, true));
          //console.log('after:eval=', printString(evaluated, true));
          // check if mal-hosted
          /*          if (func && isFunction(func)) {
           if (func.ast) {
           ast = func.ast;
           env = new Env(func.env, func.params, args);
           break;
           } else {
           return func.fn(...args);
           }
           }*/
          if (!func.ast) {
            return func.fn(...args);
          } else {
            ast = func.ast;
            env = new Env(func.env, func.params, args);
            break;
          }

          return evaluated;
      }
    }
  }
}

function evalWithEnv(env: Env) {
  return (exp: MalType) => EVAL(exp, env);
}

function evalAst(expr: MalType, env: Env): MalType {
  if (isSymbol(expr)) {
    return env.get(expr);
  } else if (isVector(expr)) {
    return createVector(...expr.map<MalType>(evalWithEnv(env)));
  } else if (isList(expr)) {
    return expr.map<MalType>(evalWithEnv(env));
  } else if (isMap(expr)) {
    const mappedEntries = map((kv: [string, MalType]) => [kv[0], EVAL(kv[1], env)] as [string, MalType], expr);
    return new Map(mappedEntries);
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
replEnv.set(createSymbol('eval'), createMalFunction(evalWithEnv(replEnv)));

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

rep('(def! *host-language* "typescript")');

if (process.argv && process.argv.length > 2) {
  replEnv.set(createSymbol('*ARGV*'), process.argv.slice(3));
  rep(`(load-file "${process.argv[2]}")`);
}

//rep('(map? (with-meta {"abc" 123} {"a" 1}))');
/*
rep(`
(def! eval-ast (fn* [ast env] (do
  ;;(do (prn "eval-ast" ast "/" (keys env)) )
  (cond
    (symbol? ast) (or (get env (str ast))
                      (throw (str ast " not found")))

    (list? ast)   (map (fn* [exp] (EVAL exp env)) ast)

    (vector? ast) (apply vector (map (fn* [exp] (EVAL exp env)) ast))

    (map? ast)    (apply hash-map
                      (apply concat
                        (map (fn* [k] [k (EVAL (get ast k) env)])
                             (keys ast))))

    "else"        ast))))
`);
rep(`
(def! repl-env {"+" +
                "-" -
                "*" *
                "/" /})
`);
rep(`(eval-ast [1] repl-env)`);
*/

const running = true;
while (running) {
  const line = readline('user> ');
  try {
    console.log(rep(line));
  } catch (err) {
    console.log(err.message);
  }

}
