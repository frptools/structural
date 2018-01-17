import { getMutationContext, isMutationContext, isSubordinateContext, asSubordinateContext, isMutableContext, mutable, clone } from './mutation';
import { PersistentStructure } from './PersistentStructure';
import { MutationContext } from './MutationContext';
import { incScope } from './_internal';

export function modify<T extends PersistentStructure>(value: T): T {
  var mc = getMutationContext(value);
  return isMutableContext(mc)
    ? isSubordinateContext(mc)
      ? value
      : (incScope(mc), value)
    : clone(value, mutable());
}

/** Returns the second argument as a mutable subordinate of the first argument. If the first argument is already
 * subordinate to an existing mutation context, the subordinate context reference is shared as-is. Committing the
 * primary context's modifications (via commit(), passing in the context owner) has the side effect of ending
 * modifications on any mutable objects whose mutation context is subordinate to the primary context. Committing
 * modifications directly on a subordinate object has no effect; that object will remain mutable until commit() is
 * called on the context owner (i.e. the object for which the mutable context was originally created).
*/
export function modifyAsSubordinate<T extends PersistentStructure>(context: PersistentStructure | MutationContext, value: T): T {
  const mctxChild = getMutationContext(value);
  const mctxParent = isMutationContext(context) ? context : getMutationContext(context);

  return isMutableContext(mctxParent)
    ? isRelatedContext(mctxChild, mctxParent) && isSubordinateContext(mctxChild)
      ? value
      : clone(value, asSubordinateContext(mctxParent))
    : error('The first argument must refer to a mutable object or mutation context');
}

/** Returns the second argument as a mutable equal of the first argument (as context owner if the first argument is the
 * context owner or is immutable, or as subordinate if the first argument also has a subordinate context) */
export function modifyAsEqual<T extends PersistentStructure>(context: PersistentStructure | MutationContext, value: T): T {
  const mcChild = getMutationContext(value);
  const mcParent = isMutationContext(context) ? context : getMutationContext(context);

  return isMutableContext(mcParent)
    ? isRelatedContext(mcChild, mcParent) && (isSubordinateContext(mcParent) || isPrimaryContext(mcChild))
      ? value
      : clone(value, mcParent)
    : error('The first argument must refer to a mutable object or mutation context');
}

/**
 * Ensures that the specified child property is a mutable member of the same batch that is currently active for its
 * parent. If the child is already part of the same mutation batch, it is returned as-is. If not, it is cloned as a
 * subordinate of the parent's mutation batch, reassigned to the parent and then returned.
 *
 * @export
 * @template T The type of the parent
 * @template P The child property key
 * @template R The type of the child
 * @param {T} owner The parent containing the child object to be modified
 * @param {P} child The property name of the child object to be modified
 * @returns {T[P]} A reference to the child object, ready for mutation
 */
export function modifyProperty<T extends PersistentStructure & {[N in P]: R}, P extends keyof T, R extends PersistentStructure>(parent: T, name: P): T[P] {
  if (isImmutable(parent)) return error('Cannot modify properties of an immutable object'); // ## DEV ##
  let child = parent[name];

  if (isRelatedContext(getMutationContext(child), getMutationContext(parent))) return child;
  parent[name] = child = clone(child, parent);
  return child;
}
