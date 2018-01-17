import { PersistentStructure } from './PersistentStructure';
import { getMutationContext } from './mutation';
import { MutationContext } from './MutationContext';

export function error (message: string): never {
  throw new Error(message);
}

export function isBoolean (value: any): value is boolean {
  return typeof value === 'boolean';
}

export function isObject (value: any): boolean {
  return typeof value === 'object' && value !== null;
}

export function token (value: PersistentStructure): [boolean] {
  return getMutationContext(value).token;
}

export function close (mctx: MutationContext): void {
  mctx.token[0] = false;
}

export function incScope (mctx: MutationContext): void {
  (<any>mctx).scope++;
}

export function decScope (mctx: MutationContext): void {
  (<any>mctx).scope--;
}
