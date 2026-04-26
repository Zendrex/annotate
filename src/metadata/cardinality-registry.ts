import type { Cardinality, ListMetadataKey, UniqueMetadataKey } from "./types";

/**
 * Module-level registry mapping every minted `MetadataKey` symbol to its cardinality.
 *
 * Uses a `WeakMap` so entries are eligible for GC when the owning symbol is no longer
 * reachable. Only unique symbols (from `Symbol()`) qualify as `WeakMap` keys — our mint
 * helpers always produce unique symbols, so this is always safe.
 */
const registry = new WeakMap<symbol, Cardinality>();

/**
 * Mint a new symbol registered as a `"unique"` metadata key. Each call produces a
 * distinct symbol — never reuse the same key across separate factories.
 *
 * @param description - Optional symbol description, forwarded to `Symbol()` as-is.
 * @returns A branded `UniqueMetadataKey<T>` registered in the cardinality registry.
 */
export function mintUniqueKey<T>(description?: string): UniqueMetadataKey<T> {
	const key = Symbol(description);
	registry.set(key, "unique");
	// Safe: we control creation and the brand is phantom-only.
	return key as UniqueMetadataKey<T>;
}

/**
 * Mint a new symbol registered as a `"list"` metadata key. Each call produces a
 * distinct symbol — never reuse the same key across separate factories.
 *
 * @param description - Optional symbol description, forwarded to `Symbol()` as-is.
 * @returns A branded `ListMetadataKey<T>` registered in the cardinality registry.
 */
export function mintListKey<T>(description?: string): ListMetadataKey<T> {
	const key = Symbol(description);
	registry.set(key, "list");
	// Safe: we control creation and the brand is phantom-only.
	return key as ListMetadataKey<T>;
}

/**
 * Look up the cardinality of a symbol in the registry.
 *
 * Returns `"unique"` or `"list"` for keys produced by {@link mintUniqueKey} or
 * {@link mintListKey}, and `undefined` for any symbol not registered through those
 * helpers (e.g. raw `Symbol("x")` or keys from third-party code).
 *
 * @param key - Any symbol, including unbranded ones.
 */
export function getKeyCardinality(key: symbol): Cardinality | undefined {
	return registry.get(key);
}
