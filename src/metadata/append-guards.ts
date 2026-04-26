import { DuplicateMetadataError, UnregisteredMetadataKeyError } from "../errors";
import { getKeyCardinality } from "./cardinality-registry";
import type { AnyConstructor, DecoratedKind } from "../reflector/types";
import type { Cardinality, Ctor, MetadataKey } from "./types";

/**
 * Resolves the registered cardinality for `key`, throwing
 * `UnregisteredMetadataKeyError` when the key was not minted via
 * `mintUniqueKey` / `mintListKey`. Single source of truth for the pre-allocation
 * guard shared by `appendClassMeta` and `appendMemberMeta`.
 */
export function requireCardinality(ctor: Ctor, key: symbol): Cardinality {
	const cardinality = getKeyCardinality(key);
	if (cardinality === undefined) {
		throw new UnregisteredMetadataKeyError(ctor as AnyConstructor, key as MetadataKey);
	}
	return cardinality;
}

/**
 * Throws `DuplicateMetadataError` when `cardinality` is `"unique"` and the slot
 * already holds at least one value. No-op for `"list"`. Run after the bucket
 * for `(ctor, key, ...)` has been allocated so `currentLength` reflects what is
 * actually stored.
 */
export function assertNotDuplicate(
	ctor: Ctor,
	key: symbol,
	cardinality: Cardinality,
	currentLength: number,
	kind: DecoratedKind,
	memberName?: string | symbol
): void {
	if (cardinality === "unique" && currentLength > 0) {
		throw new DuplicateMetadataError(ctor as AnyConstructor, key as MetadataKey, cardinality, kind, memberName);
	}
}
