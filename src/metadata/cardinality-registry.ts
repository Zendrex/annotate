import type { Cardinality, ListMetadataKey, MetadataKey, UniqueMetadataKey } from "./types";

// WeakMap is safe here: mint helpers always produce unique symbols (from `Symbol()`),
// which qualify as WeakMap keys; entries become GC-eligible with the owning symbol.
const registry = new WeakMap<symbol, Cardinality>();

/**
 * Mints a new symbol branded as `MetadataKey<T>` and registers it under the given cardinality.
 *
 * Prefer {@link mintUniqueKey} and {@link mintListKey} at call sites; reach for
 * `mintMetadataKey` only inside generic builders that pass cardinality as a runtime arg.
 */
export function mintMetadataKey<T>(cardinality: "unique", description?: string): UniqueMetadataKey<T>;
export function mintMetadataKey<T>(cardinality: "list", description?: string): ListMetadataKey<T>;
export function mintMetadataKey<T>(cardinality: Cardinality, description?: string): MetadataKey<T> {
	const key = Symbol(description);
	registry.set(key, cardinality);
	return key as MetadataKey<T>;
}

/**
 * Mints a new `"unique"` metadata key. Each call produces a distinct symbol — never
 * reuse the same key across separate factories.
 */
export function mintUniqueKey<T>(description?: string): UniqueMetadataKey<T> {
	return mintMetadataKey<T>("unique", description);
}

/**
 * Mints a new `"list"` metadata key. Each call produces a distinct symbol — never
 * reuse the same key across separate factories.
 */
export function mintListKey<T>(description?: string): ListMetadataKey<T> {
	return mintMetadataKey<T>("list", description);
}

/** Cardinality of `key` if registered via the mint helpers, else `undefined`. */
export function getKeyCardinality(key: symbol): Cardinality | undefined {
	return registry.get(key);
}
