'use strict';
import {readline} from './node_readline';
import {readString} from './reader';
import {MalType} from './types';
import {printString} from './printer';

function READ(str: string) {
  return readString(str);
}

function EVAL(form: MalType) {
  return form;
}

function PRINT(obj: MalType) {
  return printString(obj);
}

function rep(str: string) {
  return PRINT(EVAL(READ(str)));
}

while (true) {
  const line = readline('user> ');
  try {
    console.log(rep(line));
  } catch (err) {
    console.log(err.message);
  }
}
