import type { Cardinality, ListMetadataKey, MetadataKey, UniqueMetadataKey } from "./types";

/**
 * Module-level registry mapping every minted `MetadataKey` symbol to its cardinality.
 *
 * Uses a `WeakMap` so entries are eligible for GC when the owning symbol is no longer
 * reachable. Only unique symbols (from `Symbol()`) qualify as `WeakMap` keys — our mint
 * helpers always produce unique symbols, so this is always safe.
 */
const registry = new WeakMap<symbol, Cardinality>();

/**
 * Mint a new symbol branded as a `MetadataKey<T>` and register it under the given
 * cardinality. The overloads narrow the return type from the literal argument:
 * passing `"unique"` returns a {@link UniqueMetadataKey} and `"list"` returns a
 * {@link ListMetadataKey} — no redundant second generic required at call sites.
 *
 * Prefer the cardinality-specific helpers — {@link mintUniqueKey} and {@link mintListKey} —
 * for end-user code: they read more clearly at call sites. Use `mintMetadataKey`
 * inside generic builders that need to pass cardinality as a runtime argument.
 *
 * @param cardinality - `"unique"` (at most one value per site) or `"list"` (accumulates).
 * @param description - Optional symbol description, forwarded to `Symbol()` as-is.
 * @returns A branded `MetadataKey<T>` registered in the cardinality registry.
 */
export function mintMetadataKey<T>(cardinality: "unique", description?: string): UniqueMetadataKey<T>;
export function mintMetadataKey<T>(cardinality: "list", description?: string): ListMetadataKey<T>;
export function mintMetadataKey<T>(cardinality: Cardinality, description?: string): MetadataKey<T> {
	const key = Symbol(description);
	registry.set(key, cardinality);
	// Safe: brand is phantom-only; we control both cardinality and symbol creation.
	return key as MetadataKey<T>;
}

/**
 * Mint a new symbol registered as a `"unique"` metadata key. Each call produces a
 * distinct symbol — never reuse the same key across separate factories.
 *
 * @param description - Optional symbol description, forwarded to `Symbol()` as-is.
 * @returns A branded `UniqueMetadataKey<T>` registered in the cardinality registry.
 */
export function mintUniqueKey<T>(description?: string): UniqueMetadataKey<T> {
	return mintMetadataKey<T>("unique", description);
}

/**
 * Mint a new symbol registered as a `"list"` metadata key. Each call produces a
 * distinct symbol — never reuse the same key across separate factories.
 *
 * @param description - Optional symbol description, forwarded to `Symbol()` as-is.
 * @returns A branded `ListMetadataKey<T>` registered in the cardinality registry.
 */
export function mintListKey<T>(description?: string): ListMetadataKey<T> {
	return mintMetadataKey<T>("list", description);
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
