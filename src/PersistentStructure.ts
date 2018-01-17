import { MutationContext } from './MutationContext';

/**
 * All persistent structures must implement this interface in order to participate in batches of
 * mutations among multiple persistent objects of different types. Though designed to allow for
 * batched mutations, `PersistentStructure` and the associated API functions provide a convenient
 * suite of functionality for providing any structural type with persistent/immutable behaviour and
 * associated mutation characteristics.
 *
 * @export
 * @interface PersistentStructure
 */
export interface PersistentStructure {
  /**
   * The associated mutation context. During construction of the first version of a persistent
   * object, use `immutableContext()` if default immutability is required, or `mutableContext()` if
   * the object should be constructed in a mutable state. Do not reassign this property after it has
   * been assigned during construction. Do not ever directly modify its internal properties.
   *
   * @type {MutationContext}
   * @memberOf PersistentStructure
   */
  readonly '@@mctx': MutationContext;

  /**
   * Create a clone of the structure, retaining all relevant internal properties and state as-is.
   * The method is provided with a new MutationContext instance, which should be assigned to the
   * clone of the object during construction. Internal subordinate persistent substructures should
   * not be cloned at this time. When updates are being applied to a persistent object,
   * substructures should use `asMutable()`, with their owning structure passed in as the joining
   * context.
   *
   * @param {MutationContext} mctx
   * @returns {PersistentStructure}
   *
   * @memberOf PersistentStructure
   */
  '@@clone' (mctx: MutationContext): PersistentStructure;
}