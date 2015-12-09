'use strict';
import {
    MalType,
    NIL,
    MalHashMap,
    MalList,
    MalVector,
    createSymbol,
    isString,
    isKeyword,
    createKeyword,
    objToKey
} from './types';

export function readString(str: string) {
  return readForm(new Reader(tokenizer(str)));
}

const DEBUG = process.env.DEBUG;

class Reader {
  private tokens: string[];
  private position: number = 0;

  constructor(tokens: string[]) {
    if (DEBUG) {
      console.log(tokens);
    }
    this.tokens = tokens.map(x => x.trim());
  }

  next(): string {
    return this.tokens[this.position++];
  }

  peek(): string {
    return this.tokens[this.position];
  }

  eof(): boolean {
    return this.position >= this.tokens.length;
  }
}

const TOKEN_REGEX = /[\s,]*(~@|[\[\]{}()'`~^@]|"(?:\\.|[^\\"])*"|;.*|[^\s\[\]{}('"`,;)]*)/g;

function* regexCaptures(re: RegExp, str: string) {
  let match: string;
  while ((match = re.exec(str)[1]) !== '') {
    if (match[0] !== ';') {
      yield match;
    }
  }
  TOKEN_REGEX.lastIndex = 0;
}

function tokenizer(input: string): string[] {
  const res: string[] = [];

  for (const match of regexCaptures(TOKEN_REGEX, input)) {
    res.push(match);
  }

  return res;
}

function readForm(reader: Reader): MalType {
  if (reader.eof()) {
    return NIL;
  }

  const token = reader.peek();
  switch (token) {
    case '(':
      return readList(reader);
    case ')':
      throw new Error('mismatched parens');
    case ';':
    case ';;':
      return NIL;
    case '[':
      return readVector(reader);
    case '{':
      return readHashMap(reader);
    case '\'':
    case '`':
    case '~':
    case '~@':
    case '@':
      return new MalList(READER_MAPPINGS[reader.next()], readForm(reader));
    case '^':
      const metaSym = READER_MAPPINGS[reader.next()];
      const meta = readForm(reader);
      return new MalList(metaSym, readForm(reader), meta);
    default:
      return readAtom(reader);
  }
}

function readVector(reader: Reader): MalVector {
  const vec: Array<MalType> = [];
  reader.next();

  while (!reader.eof() && reader.peek() !== ']') {
    vec.push(readForm(reader));
  }

  if (!reader.eof() && reader.peek() === ']') {
    reader.next();
    return MalVector.of(...vec);
  }

  throw new Error('expected \']\', got EOF');
}

function readHashMap(reader: Reader): MalHashMap {
  const res: Map<string, MalType> = new Map();
  reader.next();

  while (!reader.eof() && reader.peek() !== '}') {
    const key = readForm(reader);
    const value = readForm(reader);

    if (isString(key) || isKeyword(key)) {
      res.set(objToKey(key), value);
    }
  }

  if (!reader.eof() && reader.peek() === '}') {
    reader.next();
    return res;
  }

  throw new Error('expected \'}\', got EOF');
}

const READER_MAPPINGS: {[key: string]: symbol} = {
  '\'': createSymbol('quote'),
  '`': createSymbol('quasiquote'),
  '~': createSymbol('unquote'),
  '~@': createSymbol('splice-unquote'),
  '^': createSymbol('with-meta'),
  '@': createSymbol('deref')
};

function readList(reader: Reader): MalList {
  const list: Array<MalType> = [];
  reader.next();

  while (!reader.eof() && reader.peek() !== ')') {
    list.push(readForm(reader));
  }

  if (!reader.eof() && reader.peek() === ')') {
    reader.next();
    return MalList.of(...list);
  }

  throw new Error('expected \')\', got EOF');
}

function readAtom(reader: Reader): MalType {
  const token = reader.next().trim();

  if (isNumericString(token)) {
    return parseInt(token);
  } else if (token[0] === '"') {
    return token.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  } else if (token === 'true' || token === 'false') {
    return token === 'true';
  } else if (token === 'nil') {
    return NIL;
  } else if (token[0] === ':') {
    return createKeyword(token.slice(1));
  }

  return createSymbol(token);
}

function isNumericString(n: string) {
  const asNum = parseInt(n);
  return !Number.isNaN(asNum) && Number.isSafeInteger(asNum);
}

