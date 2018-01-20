import { isIterable, isObject, isNothing } from '@frptools/corelib';

export interface Equatable {
  '@@equals' (other: any): boolean;
}

/**
 * Checks whether the specified argument implements `Equatable`.
 *
 * @export
 * @param {object} value
 * @returns {value is Equatable}
 */
export function isEquatable (value: object): value is Equatable;
export function isEquatable (value: object): boolean;
export function isEquatable (value: object) {
  return '@@equals' in <any>value;
}

/**
 * Checks whether two `Equatable` objects have equivalent data. If both objects implement
 * `Equatable` but are of different iterable types, their values are iterated over in tandem, and
 * checked for either strict equality, or with `isEqual` if both child values implement `Equatable`.
 *
 * @export
 * @param {Equatable} a
 * @param {Equatable} b
 * @returns {boolean} true if both arguments have the same internal
 */
export function isEqual (a: any, b: any): boolean {
  if (a === b) {
    return true;
  }

  var na = isNothing(a), nb = isNothing(b);
  if (na || nb) {
    return na === nb;
  }

  if (isObject(a)) {
    if (isEquatable(a)) {
      return a['@@equals'](b);
    }

    if (!isObject(b)) {
      return false;
    }

    if (isEquatable(b)) {
      return b['@@equals'](a);
    }

    if (isIterable(a) && isIterable(b)) {
      var ita = a[Symbol.iterator]();
      var itb = b[Symbol.iterator]();
      do {
        var ca = ita.next();
        var cb = itb.next();
        if (ca.done !== cb.done) {
          return false;
        }
        if (!ca.done) {
          var va = ca.value, vb = cb.value;
          if (!isEqual(va, vb)) {
            return false;
          }
        }
      } while (!ca.done);
      return true;
    }
  }
  else if (isObject(b) && isEquatable(b)) {
    return b['@@equals'](a);
  }

  return false;
}
