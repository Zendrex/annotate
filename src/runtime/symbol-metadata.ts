// biome-ignore lint/complexity/noBannedTypes: Constructor identity uses Function for parity with store/declaring-class modules.
type Ctor = Function;

/**
 * Stable accessor for the Stage-3 decorator metadata symbol.
 *
 * Uses `Symbol.metadata` when present (Node ≥ 20.4 / TS 5.2 lib), and falls back
 * to `Symbol.for("Symbol.metadata")` on runtimes that have not exposed the native
 * symbol (current Bun). Transpilers (tslib, Babel) and our own code must all
 * converge on the same symbol identity or the metadata bag is invisible to
 * readers — this shim ensures that invariant holds cross-runtime.
 */
export const METADATA_SYMBOL: symbol = Symbol.metadata ?? Symbol.for("Symbol.metadata");

/**
 * Read the metadata bag associated with a constructor. Returns `null` if no bag
 * is installed anywhere up the prototype chain. Inheritance lookup IS allowed
 * for reads per the Stage-3 spec — readers see their own bag through
 * `Object.create(super[Symbol.metadata])` chaining.
 */
export function readOwnMetadata(ctor: Ctor): object | null {
	const value = (ctor as unknown as Record<symbol, object | undefined>)[METADATA_SYMBOL];
	return value ?? null;
}

/**
 * Check whether `ctor` has its OWN metadata bag (not inherited). Callers that
 * need "did THIS class get decorated" must use this rather than
 * `readOwnMetadata`, because every subclass of a decorated parent inherits a
 * bag via the prototype chain.
 */
export function hasOwnMetadata(ctor: Ctor): boolean {
	return Object.hasOwn(ctor as object, METADATA_SYMBOL);
}
