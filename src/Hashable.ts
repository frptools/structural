import { isPersistent, isImmutable } from './Persistent';
import { PCGRandom, isDefined, isPlain, isIterable } from '@frptools/corelib';

export interface Hashable {
  '@@hash' (): number;
}

export function isHashable (value: object): value is Hashable;
export function isHashable (value: object): boolean;
export function isHashable (value: object): value is Hashable {
  return '@@hash' in <any>value;
}

export function hash (arg: any): number {
  return opt(_hash(arg));
}

export function hashArray (arr: any[]): number {
  return opt(_hashArray(arr));
}

export function hashArgs (...args: any[]): number;
export function hashArgs (): number {
  var h = 5381;
  for (var i = 0; i < arguments.length; i++) {
    h = _combineHash(h, hash(arguments[i]));
  }
  return opt(h);
}

export function combineHash (a: number, b: number): number {
  return opt(_combineHash(a, b));
}

export function hashObject (value: object): number {
  return opt(_hashObject(value));
}

export function hashMiscRef (o: Object): number {
  return opt(_hashMiscRef(o));
}

export function hashIterator (it: Iterator<any>): number {
  return opt(_hashIterator(it));
}

export function hashPlainObject (o: object): number {
  return opt(_hashPlainObject(o));
}

export function hashNumber (n: number): number {
  return opt(_hashNumber(n));
}

export function hashString (str: string): number {
  return opt(_hashString(str));
}

function isZero (value: any): boolean {
  return value === null || value === void 0 || value === false;
}

const RANDOM = new PCGRandom(13);
const CACHE = new WeakMap<Object, number>();

function randomInt () {
  return RANDOM.integer(0x7FFFFFFF);
}

function _hash (arg: any): number {
  if (isZero(arg)) return 0;
  if (typeof arg.valueOf === 'function' && arg.valueOf !== Object.prototype.valueOf) {
    arg = arg.valueOf();
    if (isZero(arg)) return 0;
  }
  switch (typeof arg) {
    case 'number': return _hashNumber(arg);
    case 'string': return _hashString(arg);
    case 'function': return _hashMiscRef(arg);
    case 'object': return _hashObject(arg);
    case 'boolean': return arg === true ? 1 : 0;
    default: return 0;
  }
}

function _hashArray (arr: any[]): number {
  var h = 6151;
  for (var i = 0; i < arr.length; i++) {
    h ^= _combineHash(_hashNumber(i), _hash(arr[i]));
  }
  return h;
}

function _combineHash (a: number, b: number): number {
  return (a * 53) ^ b;
}

function _hashObject (value: object): number {
  var h = CACHE.get(value);
  if (isDefined(h)) return h;

  if (Array.isArray(value)) {
    h = _hashArray(value);
  }
  else if (isHashable(value)) {
    h = value['@@hash']();
  }
  else if (isIterable(value)) {
    h = _hashIterator(value[Symbol.iterator]());
  }
  else if (isPlain(value)) {
    h = _hashPlainObject(value);
  }
  else {
    h = randomInt();
  }
  if (!isPersistent(value) || isImmutable(value)) {
    CACHE.set(value, h);
  }
  return h;
}

function _hashMiscRef (o: Object): number {
  var h = CACHE.get(o);
  if (isDefined(h)) return h;
  h = randomInt();
  CACHE.set(o, h);
  return h;
}

function _hashIterator (it: Iterator<any>): number {
  var h = 6151;
  var current: IteratorResult<any>;
  while (!(current = it.next()).done) {
    h = _combineHash(h, hash(current.value));
  }
  return h;
}

function _hashPlainObject (o: object): number {
  CACHE.set(o, randomInt());
  var keys = Object.keys(o);
  var h = 12289;
  for (var i = 0; i < keys.length; i++) {
    h = _combineHash(h, _hashString(keys[i]));
    h = _combineHash(h, hash((o as any)[keys[i]]));
  }
  return h;
}

function _hashNumber (n: number): number {
  if (n !== n || n === Infinity) return 0;
  var h = n | 0;
  if (h !== n) h ^= n * 0xFFFFFFFF;
  while (n > 0xFFFFFFFF) h ^= (n /= 0xFFFFFFFF);
  return n;
}

function _hashString (str: string): number {
  var h = 5381, i = str.length;
  while (i) h = (h * 33) ^ str.charCodeAt(--i);
  return h;
}

function opt (n: number) {
  return (n & 0xbfffffff) | ((n >>> 1) & 0x40000000);
}