import type { Ctor } from "../metadata/types";

/**
 * Native `Symbol.metadata` when present; otherwise the registry-shared
 * `Symbol.for("Symbol.metadata")` fallback. The shim in `src/shim.ts` installs
 * the same value globally, keeping the transformer and runtime on a single
 * slot across stage-3-aware and unaware environments.
 */
export const METADATA_SYMBOL: symbol = Symbol.metadata ?? Symbol.for("Symbol.metadata");

/** Reads the own (non-inherited) {@link METADATA_SYMBOL} value; `undefined` is returned as `null`. */
export function readOwnMetadata(ctor: Ctor): object | null {
	const value = (ctor as unknown as Record<symbol, object | undefined>)[METADATA_SYMBOL];
	return value ?? null;
}

/**
 * Whether `ctor` has an own {@link METADATA_SYMBOL} slot. A `true` result does
 * not guarantee the value is a non-null object — pair with
 * {@link readOwnMetadata} when the value matters.
 */
export function hasOwnMetadata(ctor: Ctor): boolean {
	return Object.hasOwn(ctor as object, METADATA_SYMBOL);
}
