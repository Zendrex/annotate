import type { ListMetadataKey, UniqueMetadataKey } from "./types";

// Branded key aliases are imported for return types only; they are exported from types.ts directly.

/**
 * Module-level registry mapping every minted `MetadataKey` symbol to its cardinality.
 *
 * We use a plain `Map` rather than a `WeakMap` because `WeakMap` only accepts object
 * keys — symbol support was added in ES2023 (`WeakMap<symbol>`). While the project
 * targets ESNext, a plain `Map` is simpler and avoids any subtle lib/target mismatch.
 * The set of registered keys is bounded by the number of decorated factories in a
 * process, so memory growth is not a concern.
 */
const registry = new Map<symbol, "unique" | "list">();

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
export function getKeyCardinality(key: symbol): "unique" | "list" | undefined {
	return registry.get(key);
}
