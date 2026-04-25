// biome-ignore lint/complexity/noBannedTypes: Constructor identity uses Function for parity with store/declaring-class modules.
type Ctor = Function;

/**
 * Key used for Symbol.metadata-style constructor metadata. Uses native
 * `Symbol.metadata` when available; otherwise `Symbol.for("Symbol.metadata")` so
 * the same slot is shared across the metadata layer and stage-3 decorator output.
 */
export const METADATA_SYMBOL: symbol = Symbol.metadata ?? Symbol.for("Symbol.metadata");

/**
 * Reads the **own** metadata object on `ctor` for {@link METADATA_SYMBOL}, not
 * values inherited from the prototype chain. Missing or undefined values are
 * normalized to `null`.
 */
export function readOwnMetadata(ctor: Ctor): object | null {
	const value = (ctor as unknown as Record<symbol, object | undefined>)[METADATA_SYMBOL];
	return value ?? null;
}

/**
 * Whether `ctor` defines its own property for {@link METADATA_SYMBOL} (via
 * `Object.hasOwn`). A `true` result does not imply a non-null correlation
 * object; pair with {@link readOwnMetadata} to distinguish empty slots.
 */
export function hasOwnMetadata(ctor: Ctor): boolean {
	return Object.hasOwn(ctor as object, METADATA_SYMBOL);
}
