'use strict';
import {MalType, MalFunction, MalList} from './types';

export class Env {
  private data: Map<symbol, MalType>;
  
  constructor(private outer: Env, binds?: symbol[], exprs?: MalType[]) {
    this.outer = outer;
    this.data = new Map();
    binds = binds || [];
    exprs = exprs || [];

    for (let i = 0; i < binds.length; i++) {
      if (binds[i] === Symbol.for('&')) {
        this.set(binds[i+1], exprs.slice(i));
        break;
      }

      this.set(binds[i], exprs[i]);
    }
  }

  set(key: symbol, val: MalType): MalType {
    this.data.set(key, val);
    return val;
  }

  find(key: symbol): Env {
    if (this.data.has(key)) {
      return this;
    } else if (this.outer) {
      return this.outer.find(key);
    }

    return null;
  }

  get(key: symbol): MalType {
    const containingEnv = this.find(key);

    if (containingEnv) {
      return containingEnv.data.get(key);
    }

    throw new Error(`'${Symbol.keyFor(key)}' not found`);
  }
}


