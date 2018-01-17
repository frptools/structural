import { MutationContext } from './MutationContext';
import { PersistentStructure } from './PersistentStructure';
import { isBoolean, isObject, error } from './_internal';

/**
 * Checks whether the input object implements the `Persistent` interface, and narrows the input type
 * accordingly.
 *
 * @export
 * @param {object} value An object instance to test
 * @returns {value is Persistent} true if the value implements the `Persistent` interface, otherwise false
 */
export function isPersistent (value: object): value is PersistentStructure;
export function isPersistent (value: object): boolean;
export function isPersistent (value: object) {
  return '@@mctx' in <any>value;
}

const FROZEN = Object.freeze(new MutationContext([false], -1));

/** A persistent object to become subordinate to (i.e. a mutation batch can only be terminated using the persistent
 * object for which the mutation batch was created), a mutation context to use directly, true to start a new mutable
 * context, or false to ensure that the context is frozen/immutable. */
export type PreferredContext = PersistentStructure | MutationContext | boolean;

export function modify<T extends PersistentStructure>(value: T): T {
  var mc = getMutationContext(value);
  return isMutableContext(mc)
    ? isSubordinateContext(mc)
      ? value
      : (incScope(mc), value)
    : clone(value, mutable());
}

export function commit<T extends PersistentStructure>(value: T): T {
  var mc = getMutationContext(value);
  return isPrimaryContext(mc) && (mc.scope === 0 ? close(mc) : decScope(mc)), value;
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

export function isContextOwner (value: PersistentStructure): boolean {
  return isPrimaryContext(getMutationContext(value));
}

/**
 * Returns a version of the input value that matches the mutability specified by the first argument. If the first
 * argument is a mutable object, the returned value will be cloned into the same mutation batch with a mutable context
 * that is subordinate to the batch owner.
 *
 * @export
 * @template T The type of the persistent value to apply the specified mutability argument to
 * @param {(PreferredContext|undefined)} mutability The desired mutability of the return value
 * @param {T} value A value to align with the desired mutability
 * @returns {T} A reference to, or clone of, the `value` argument
 */
export function withMutability<T extends PersistentStructure>(mutability: PreferredContext | undefined, value: T): T {
  let mctx: MutationContext;
  if (mutability === void 0) {
    mctx = FROZEN;
  }
  else if (isBoolean(mutability)) {
    if (mutability === isMutable(value)) return value;
    mctx = mutability ? mutable() : FROZEN;
  }
  else if (isMutationContext(mutability)) {
    if (isRelatedContext(mutability, getMutationContext(value))) return value;
    mctx = mutability;
  }
  else {
    if (areContextsRelated(mutability, value)) return value;
    mctx = getSubordinateContext(mutability);
  }
  value = <T>value['@@clone'](mctx);
  return value;
}

/**
 * Returns the default frozen mutation context for use with new immutable objects. This function
 * should only be used when constructing the first version of a new persistent object. Any
 * subsequent copies of that object should use `doneMutating()` and related functions.
 *
 * @export
 * @returns {MutationContext} The default frozen mutation context
 */
export function immutable (): MutationContext {
  return FROZEN;
}

/**
 * Makes a mutable context immutable, along with all associated subordinate contexts. If the input
 * argument is itself a subordinate context, this function does nothing.
 *
 * @export
 * @param {MutationContext} mctx
 */
export function commitContext (mctx: MutationContext): void {
  if (isPrimaryContext(mctx)) close(mctx);
}

/**
 * Returns a new mutable context to be associated with, and owned by, a persistent object. This
 * function should only be used when constructing the first version of a new persistent object. Any
 * subsequent updates to that object should use `asMutable()` and related functions.
 *
 * @export
 * @returns {MutationContext}
 */
export function mutable (): MutationContext {
  return new MutationContext([true], 0);
}

/** Returns a mutation context that matches the mutability characteristics of the supplied argument.
 * If no argument is supplied, an immutable context is returned. If the argument is another mutable
 * object, the returned context will be a mutable subordinate to that context, or a direct reference
 * to that context if it is already subordinate to some other mutable context.
 *
 * @export
 * @returns {MutationContext}
 */
export function selectContext (mutability?: PreferredContext): MutationContext {
  return mutability === void 0 ? FROZEN
    : isBoolean(mutability) ? mutability ? mutable() : FROZEN
      : isMutationContext(mutability) ? mutability
        : getSubordinateContext(mutability);
}

export function getMutationContext (value: PersistentStructure): MutationContext {
  return value['@@mctx'];
}

/**
 * Determines whether a value is a MutationContext object instance.
 *
 * @export
 * @param {*} value
 * @returns {value is MutationContext}
 */
export function isMutationContext (value: any): value is MutationContext;
export function isMutationContext (value: any): boolean;
export function isMutationContext (value: any) {
  return isObject(value) && value instanceof MutationContext;
}

/**
 * Tests whether the value is currently in a mutable state, with changes able to be applied directly
 * to the value, rather than needing to clone the value first.
 *
 * @export
 * @param {PersistentStructure} value A value to test for mutability
 * @returns {boolean} true if the value may be mutated directly, otherwise false
 */
export function isMutable (value: PersistentStructure): boolean {
  return isMutableContext(getMutationContext(value));
}

/**
 * Tests whether the value is currently in an immutable state, requiring a clone to be created if
 * mutations are desired.
 *
 * @export
 * @param {PersistentStructure} value A value to be tested for immutability
 * @returns {boolean} true if direct mutations to the value or its contents are forbidden, otherwise false
 */
export function isImmutable (value: PersistentStructure): boolean {
  return !isMutable(value);
}

export function isMutableContext (mctx: MutationContext): boolean {
  return mctx.token[0];
}

export function isImmutableContext (mctx: MutationContext): boolean {
  return !isMutableContext(mctx);
}

/**
 * Tests whether two values are currently part of the same active batch of uncommitted mutations,
 * whereby committing the mutation context of the value where it originated will cause all other
 * structures that share the same mutation context to become immutable also.
 *
 * After a shared context is committed, this function can be used to lazily apply changes to data
 * structures that are private and internal to an outer data structure. An example is `Slot` objects
 * contained within the `List` data structure. Those objects are never accessed via the `List`
 * structure's public API, but are often the target of latebound changes applied well after a
 * mutation context has been committed. By checking if they shared the same context as their parent,
 * it can be determined whether they need to be cloned and replaced, or if they can be mutated in
 * place so as to apply any pending changes before their internal data is queried as part of a call
 * being made against the outer structure.
 *
 * @export
 * @param {PersistentStructure} a A value to compare with `b`
 * @param {PersistentStructure} b A value to compare with `a`
 * @returns {boolean} true if both values are associated with the same active mutation context, otherwise false
 */
export function areContextsRelated (a: PersistentStructure, b: PersistentStructure): boolean {
  // var ta = token(a);
  // var tb = token(b);
  // return ta === tb || (!ta[0] && !tb[0]);
  return token(a) === token(b);
}

export function hasRelatedContext (mctx: MutationContext, value: PersistentStructure): boolean {
  return mctx.token === token(value);
}

/**
 * Performs a shallow clone of a persistent structure. It is up to the API that provides structural
 * manipulation operations on the input type to ensure that, before applying mutations, any relevant
 * internal substructures are cloned when their associated mutation contexts do not match that of
 * their owner.
 *
 * @export
 * @template T The type of the persistent structure
 * @param {T} value The structure to clone
 * @param {MutationContext|boolean} mutable The mutation context to be associated with the cloned
 *   structure, or a boolean value to indicate whether or not to associate the cloned structure with
 *   a new mutable context. If omitted, the existing mutation context is shadowed.
 * @returns {T} A cloned instance of a persistent structure
 */
export function clone<T extends PersistentStructure>(value: T, mutability?: PreferredContext): T {
  return <T>value['@@clone'](selectContext(mutability));
}

/**
 * Returns a version of the `value` argument that is guaranteed to have the specified mutation
 * context instance. The `value` argument is cloned only if its mutation context does not match the
 * `mctx` argument. Note that the exact `mctx` reference is checked; this function does not check if
 * the contexts are related, or whether or not they're mutable, it simply ensures that the returned
 * value uses the referenced mutation context instance.
 *
 * @export
 * @template T The type of the persistent structure
 * @param {MutationContext} mctx The desired mutation context
 * @param {T} value the value to which the specified mutation context should be attached
 * @returns {T} A reference to the `value` argument if it already has the specified context, or the
 *   `value` argument cloned using the `mctx` argument otherwise.
 */
export function ensureContext<T extends PersistentStructure>(mctx: MutationContext, value: T): T {
  return getMutationContext(value) === mctx ? value : <T>value['@@clone'](mctx);
}

/**
 * Returns a mutation context that is subordinate to that of the object it was created for. The
 * returned mutation context matches the mutability of the one from which it is being cloned.
 *
 * @export
 * @param {Persistent} value
 * @returns {MutationContext}
 */
export function getSubordinateContext (value: PersistentStructure): MutationContext {
  return asSubordinateContext(getMutationContext(value));
}

/**
 * Returns a mutation context that is subordinate to the input context. The returned context cannot
 * be used to complete a batch of mutations, but objects to which it is attached will automatically
 * become immutable when the original (non-subordinate) context is frozen. If the input context is
 * already subordinate to another, it can be safely shared among multiple host objects, and is
 * therefore returned as-is, rather than being cloned. Mutation contexts do not retain any
 * hierarchy beyond being subordinate to the originating/owning context, hence the lack of
 * subsequent cloning. This also reduces allocations by enabling reference sharing.
 *
 * @export
 * @param {MutationContext} mctx A mutation context for which a subordinate context is required
 * @returns {MutationContext} A subordinate mutation context
 */
export function asSubordinateContext (mctx: MutationContext): MutationContext {
  return mctx.scope >= 0 ? new MutationContext(mctx.token, -1) : mctx;
}

export function isPrimaryContext (mctx: MutationContext): boolean {
  return mctx.scope >= 0;
}

export function isSubordinateContext (mctx: MutationContext): boolean {
  return mctx.scope === -1;
}

function isRelatedContext (a: MutationContext, b: MutationContext): boolean {
  return a.token === b.token;
}

export type UpdaterFn<T extends PersistentStructure, U> = (value: T) => U;

/**
 * Allows batches of in-place mutations to be applied to a persistent object. When mutations are
 * completed, if the input value was already mutable, it is passed to the mutation function as-is,
 * and returned when the mutation function returns. If the input value was immutable, a mutable copy
 * is passed to the mutation function, and then frozen before being returned.
 *
 * @param mutate A function that is passed a mutable version of the input value
 * @param value An updated version of the input value
 */
export function update<T extends PersistentStructure>(mutate: UpdaterFn<T, any>, value: T): T {
  value = modify(value);
  mutate(value);
  return commit(value);
}

function token (value: PersistentStructure): [boolean] {
  return getMutationContext(value).token;
}

function close (mctx: MutationContext): void {
  mctx.token[0] = false;
}

function incScope (mctx: MutationContext): void {
  (<any>mctx).scope++;
}

function decScope (mctx: MutationContext): void {
  (<any>mctx).scope--;
}
