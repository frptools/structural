import { MutationContext } from './MutationContext';

/** Just an alias; facilitates the use case `import * as Mutation`, allowing
 * `mctx: Mutation.Context`, rather than `mctx: Mutation.MutationContext which is less readable. */
export type Context = MutationContext;
