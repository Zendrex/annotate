import type { Cardinality, ListMetadataKey, MetadataKey, UniqueMetadataKey } from "./types";

// WeakMap is safe here: mint helpers always produce unique symbols (from `Symbol()`),
// which qualify as WeakMap keys; entries become GC-eligible with the owning symbol.
const registry = new WeakMap<symbol, Cardinality>();

export function mintMetadataKey<T>(cardinality: "unique", description?: string): UniqueMetadataKey<T>;
export function mintMetadataKey<T>(cardinality: "list", description?: string): ListMetadataKey<T>;
export function mintMetadataKey<T>(cardinality: Cardinality, description?: string): MetadataKey<T> {
	const key = Symbol(description);
	registry.set(key, cardinality);
	return key as MetadataKey<T>;
}

/** Each call produces a distinct symbol; do not reuse across factories. */
export function mintUniqueKey<T>(description?: string): UniqueMetadataKey<T> {
	return mintMetadataKey<T>("unique", description);
}

/** Each call produces a distinct symbol; do not reuse across factories. */
export function mintListKey<T>(description?: string): ListMetadataKey<T> {
	return mintMetadataKey<T>("list", description);
}

export function getKeyCardinality(key: symbol): Cardinality | undefined {
	return registry.get(key);
}
