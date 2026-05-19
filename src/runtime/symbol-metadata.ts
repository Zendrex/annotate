import type { Ctor } from "../metadata/types";

export const METADATA_SYMBOL: symbol = Symbol.metadata ?? Symbol.for("Symbol.metadata");

export function readOwnMetadata(ctor: Ctor): object | null {
	const value = (ctor as unknown as Record<symbol, object | undefined>)[METADATA_SYMBOL];
	return value ?? null;
}

export function hasOwnMetadata(ctor: Ctor): boolean {
	return Object.hasOwn(ctor as object, METADATA_SYMBOL);
}
