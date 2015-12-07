'use strict';
import {readline} from './node_readline';

function READ(str: string) {
  return str;
}

function EVAL(str: string) {
  return str;
}

function PRINT(str: string) {
  return str;
}

function rep(str: string) {
  return READ(EVAL(PRINT(str)));
}

while (true) {
  const line = readline('user> ');
  console.log(rep(line));
}
