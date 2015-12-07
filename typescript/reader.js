'use strict';
var types_1 = require('./types');
function readString(str) {
    return readForm(new Reader(tokenizer(str)));
}
exports.readString = readString;
const DEBUG = process.env.DEBUG;
class Reader {
    constructor(tokens) {
        this.position = 0;
        if (DEBUG) {
            console.log(tokens);
        }
        this.tokens = tokens.map(x => x.trim());
    }
    next() {
        return this.tokens[this.position++];
    }
    peek() {
        return this.tokens[this.position];
    }
    eof() {
        return this.position >= this.tokens.length;
    }
}
const TOKEN_REGEX = /[\s,]*(~@|[\[\]{}()'`~^@]|"(?:\\.|[^\\"])*"|;.*|[^\s\[\]{}('"`,;)]*)/g;
function* regexCaptures(re, str) {
    let match;
    while ((match = re.exec(str)[1]) !== '') {
        if (match[0] !== ';') {
            yield match;
        }
    }
    TOKEN_REGEX.lastIndex = 0;
}
function tokenizer(input) {
    const res = [];
    for (const match of regexCaptures(TOKEN_REGEX, input)) {
        res.push(match);
    }
    return res;
}
function readForm(reader) {
    if (reader.eof()) {
        return types_1.NIL;
    }
    const token = reader.peek();
    switch (token) {
        case '(':
            return readList(reader);
        case ')':
            throw new Error('mismatched parens');
        case ';':
        case ';;':
            return types_1.NIL;
        case '[':
            return readVector(reader);
        case '{':
            return readHashMap(reader);
        case '\'':
        case '`':
        case '~':
        case '~@':
        case '@':
            return types_1.MalList([READER_MAPPINGS[reader.next()], readForm(reader)]);
        case '^':
            const metaSym = READER_MAPPINGS[reader.next()];
            const meta = readForm(reader);
            return types_1.MalList([metaSym, readForm(reader), meta]);
        default:
            return readAtom(reader);
    }
}
function readVector(reader) {
    const vec = [];
    reader.next();
    while (!reader.eof() && reader.peek() !== ']') {
        vec.push(readForm(reader));
    }
    if (!reader.eof() && reader.peek() === ']') {
        reader.next();
        return types_1.MalVector(vec);
    }
    throw new Error('expected \']\', got EOF');
}
function readHashMap(reader) {
    const res = new Map();
    reader.next();
    while (!reader.eof() && reader.peek() !== '}') {
        const key = readForm(reader);
        const value = readForm(reader);
        if (key.typeTag === 'keyword' || key.typeTag === 'string') {
            res.set(key.value, value);
        }
    }
    if (!reader.eof() && reader.peek() === '}') {
        reader.next();
        return types_1.MalHashMap(res);
    }
    throw new Error('expected \'}\', got EOF');
}
const READER_MAPPINGS = {
    '\'': types_1.MalSymbol('quote'),
    '`': types_1.MalSymbol('quasiquote'),
    '~': types_1.MalSymbol('unquote'),
    '~@': types_1.MalSymbol('splice-unquote'),
    '^': types_1.MalSymbol('with-meta'),
    '@': types_1.MalSymbol('deref')
};
function readList(reader) {
    const list = [];
    reader.next();
    while (!reader.eof() && reader.peek() !== ')') {
        list.push(readForm(reader));
    }
    if (!reader.eof() && reader.peek() === ')') {
        reader.next();
        return types_1.MalList(list);
    }
    throw new Error('expected \')\', got EOF');
}
function readAtom(reader) {
    const token = reader.next().trim();
    if (isNumericString(token)) {
        return types_1.MalNumber(parseInt(token));
    }
    else if (token[0] === '"') {
        return types_1.MalString(token.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\'));
    }
    else if (token === 'true' || token === 'false') {
        return types_1.MalBool(token === 'true');
    }
    else if (token === 'nil') {
        return types_1.NIL;
    }
    else if (token[0] === ':') {
        return types_1.MalKeyword(token.slice(1));
    }
    return types_1.MalSymbol(token);
}
function isNumericString(n) {
    const asNum = parseInt(n);
    return !Number.isNaN(asNum) && Number.isSafeInteger(asNum);
}
//# sourceMappingURL=reader.js.map