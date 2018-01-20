import { isObject } from '@frptools/corelib';
import { isPersistent } from './Persistent';

/**
 * An object that implements `Unwrappable` is capable of serializing itself to a native type, such
 * as a plain object or array. If children of the object will also be unwrapped, implement
 * `RecursiveUnwrappable` instead, in order to prevent infinite recursion when circular references
 * are encountered during descent.
 *
 * @export
 * @interface Unwrappable
 * @template T The expected type of the return value
 */
export interface Unwrappable<T> {
  ['@@unwrap'] (): T;
}

/**
 * An object that implements `RecursiveUnwrappable` is capable of recursively serializing itself and
 * its children to a native type, such as a plain object or array.
 *
 * @export
 * @interface RecursiveUnwrappable
 * @extends {Unwrappable<T>}
 * @template T The type of value being unwrapped
 */
export interface RecursiveUnwrappable<T> extends Unwrappable<T> {
  ['@@unwrapInto'] (target: T): T;
  ['@@createUnwrapTarget'] (): T;
}

/**
 * Checks whether the input argument implements the `Unwrappable<T>` interface, and narrows the type
 * accordingly.
 *
 * @export
 * @template T
 * @param {object} value
 * @returns {value is Unwrappable<T>}
 */
export function isUnwrappable<T>(value: object): value is Unwrappable<T>;
export function isUnwrappable<T>(value: object): boolean;
export function isUnwrappable (value: object) {
  return '@@unwrap' in <any>value;
}

/**
 * Checks whether the input argument implements the `RecursiveUnwrappable<T>` interface, and narrows
 * the type accordingly.
 *
 * @export
 * @template T
 * @param {object} value
 * @returns {value is RecursiveUnwrappable<T>}
 */
export function isRecursiveUnwrappable<T>(value: object): value is RecursiveUnwrappable<T>;
export function isRecursiveUnwrappable<T>(value: object): boolean;
export function isRecursiveUnwrappable (value: object) {
  return '@@unwrapInto' in <any>value;
}

const CIRCULARS = new WeakMap<any, any>();

/**
 * Unwraps an instance of a `Unwrappable` object as a plain JavaScript value or object. The nature
 * of the return value is determined by the implementation of the `Unwrappable` interface pertaining
 * to the input argument.
 *
 * @export
 * @template T The type of value to be unwrapped (for type matching only - no type checking is performed)
 * @param {Unwrappable<T>} value An instance of an object that implements the `Unwrappable` interface
 * @returns {T} An unwrapped (plain) object or value
 */
export function unwrap (source: any, force?: boolean): any;
export function unwrap<T = any>(source: T | Unwrappable<T>, force?: boolean): T;
export function unwrap<T = any>(source: any, force = false): any {
  if (!isObject(source)) {
    return source;
  }

  if (Array.isArray(source)) {
    return source.map(value => unwrap(value));
  }

  if (!isUnwrappable<T>(source)) {
    if (isPersistent(source) || force) {
      source = new Unwrapper(source);
    }
    else {
      return source;
    }
  }

  if (CIRCULARS.has(source)) {
    return CIRCULARS.get(source);
  }
  var value: T;
  if (isRecursiveUnwrappable<T>(source)) {
    var target = source['@@createUnwrapTarget']();
    CIRCULARS.set(source, target);
    value = source['@@unwrapInto'](target);
    CIRCULARS.delete(source);
  }
  else {
    value = source['@@unwrap']();
  }
  return value;
}

class Unwrapper implements RecursiveUnwrappable<any> {
  constructor (public source: any) { }

  ['@@unwrap'] (): any {
    return this.source;
  }

  ['@@unwrapInto'] (target: any): any {
    const keys = Object.getOwnPropertyNames(this.source);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key.startsWith('@@') || key.startsWith('_')) continue;
      target[key] = unwrap(this.source[key]);
    }
    return target;
  }

  ['@@createUnwrapTarget'] (): any {
    return {};
  }
}

export function unwrapKey (key: any): string {
  const value = unwrap(key);
  return isObject(value)
    ? JSON.stringify(value)
    : value;
}