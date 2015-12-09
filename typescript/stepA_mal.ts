'use strict';
import {readline} from './node_readline';
import {readString} from './reader';
import {printString} from './printer';
import {
    MalType,
    createSymbol,
    MalFunction,
    MalSeq,
    MalList,
    MalVector,

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
  if (!isPair(form)) {
    return MalList.of(createSymbol('quote'), form);
  } else if (form.first() === Symbol.for('unquote')) {
    return form.nth(1);
  } else {
    const firstElem = form.first();
    if (isPair(firstElem) && firstElem.first() === Symbol.for('splice-unquote')) {
      return MalList.of(createSymbol('concat'), firstElem.nth(1), quasiquote(form.rest()));
    } else {
      return MalList.of(createSymbol('cons'), quasiquote(firstElem), quasiquote(form.rest()));
    }
  }
}

function READ(str: string) {
  return readString(str);
}

function isMacroCall(ast: MalType, env: Env): boolean {
  if (isSequential(ast)) {
    const sym = ast.first();
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
    const sym = (<MalList>ast).first();
    if (isSymbol(sym)) {
      const macroFunc = env.get(sym);
      if (isFunction(macroFunc)) {
        //console.log('before:expand=', printString(ast, true));
        ast = macroFunc.fn(...(<MalList>ast).rest());
        //console.log('after:expand=', printString(ast, true));
      }
    }
  }

  return ast;
}

function EVAL(ast: MalType, env: Env): MalType {
  //console.log('ast=', printString(ast));
  while (true) {
    if (!isList(ast)) {
      return evalAst(ast, env);
    } else {
      ast = macroexpand(ast, env);
      if (!isList(ast)) {
        return ast;
      } else {
        let sym = ast.first();
        if (!isSymbol(sym)) {
          sym = createSymbol(':default');
        }
        const rest = ast.rest();
        if (isSymbol(sym) && isSequential(rest)) {
          switch (Symbol.keyFor(sym)) {
            case 'def!':
              const key = rest.first();
              if (isSymbol(key)) {
                return env.set(key, EVAL(rest.nth(1), env));
              }
              throw new Error('invalid definition');
            case 'defmacro!':
              const macroSym = rest.first();
              const macroFunc = EVAL(rest.nth(1), env);

              if (isSymbol(macroSym) && isFunction(macroFunc)) {
                macroFunc.isMacro = true;
                return env.set(macroSym, macroFunc);
              }
              throw new Error('invalid macro definition');
            case 'macroexpand':
              return macroexpand(rest.first(), env);
            case 'try*':
              try {
                return EVAL(rest.first(), env);
              } catch (e) {
                const catchClause = rest.nth(1);
                /*const malExcept = MalHashMap(new Map([
                 [MalKeyword('name'), MalString(e.name)],
                 [MalKeyword('message'), MalString(e.message)],
                 [MalKeyword('stack'), MalString(e.stack)]
                 ]));*/
                if (isList(catchClause)) {
                  const exceptSym = catchClause.nth(1);
                  if (isSymbol(exceptSym)) {
                    const exceptVal = e instanceof Error ? e.message : e;
                    const catchEnv = new Env(env, [exceptSym], [exceptVal]);

                    return EVAL(catchClause.nth(2), catchEnv);
                  }
                }
              }
              throw new Error('invalid try-catch');
            case 'let*':
              const letEnv = new Env(env);
              // TODO figure out how to improve/remove cast
              const bindings = rest.first();
              if (isSequential(bindings)) {
                const iter = bindings[Symbol.iterator]();

                for (let i = 0; i < bindings.length; i += 2) {
                  const identifierSym = iter.next().value;
                  const val = iter.next().value;
                  if (isSymbol(identifierSym)) {
                    letEnv.set(identifierSym, EVAL(val, letEnv));
                  }
                }
              }
              ast = rest.nth(1);
              env = letEnv;
              break;
            case 'do':
              evalAst(rest.butLast(), env);
              ast = rest.last();
              break;
            case 'if':
              const cond = EVAL(rest.first(), env);

              if (cond === NIL || cond === false) {
                ast = rest.length > 2 ? rest.nth(2) : NIL;
              } else {
                ast = rest.nth(1);
              }
              break;
            case 'fn*':
              const first = rest.first();
              if (isSequential(first)) {
                // TODO figure out how to improve/remove cast
                const binds = <symbol[]>Array.from(first);
                return createMalFunction((...args: MalType[]) => {
                  const fnEnv = new Env(env, binds, args);

                  return EVAL(rest.nth(1), fnEnv);
                }, rest.nth(1), binds, env);
              }
              throw new Error('improper function definition');
            case 'quote':
              return rest.first();
            case 'quasiquote':
              ast = quasiquote(rest.first());
              break;
            default:
              const evaluated = evalAst(ast, env);
              if (isList(evaluated)) {
                const func = evaluated.first();
                const args = evaluated.rest();

                //console.log('before:eval=', printString(ast, true));
                //console.log('after:eval=', printString(evaluated, true));
                // check if mal-hosted
                if (isFunction(func)) {
                  if (!func.ast) {
                    return func.fn(...args);
                  } else {
                    ast = func.ast;
                    env = new Env(func.env, func.params, Array.from(args));
                    break;
                  }
                }
              }
          }
        }
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
    return MalVector.of(...map(evalWithEnv(env), expr));
  } else if (isList(expr)) {
    return MalList.of(...map(evalWithEnv(env), expr));
  } else if (isMap(expr)) {
    const mappedEntries = map<[string, MalType], [string, MalType]>((kv) => [kv[0], EVAL(kv[1], env)], expr);
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
  replEnv.set(createSymbol('*ARGV*'), MalList.of(...process.argv.slice(3)));
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
