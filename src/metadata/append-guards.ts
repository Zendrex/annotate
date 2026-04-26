import { DuplicateMetadataError, UnregisteredMetadataKeyError } from "../errors";
import { getKeyCardinality } from "./cardinality-registry";
import type { AnyConstructor, DecoratedKind } from "../reflector/types";
import type { Cardinality, Ctor, MetadataKey } from "./types";

/**
 * Shared pre-allocation guard for `appendClassMeta` and `appendMemberMeta`.
 *
 * @throws {UnregisteredMetadataKeyError} If `key` was not minted via `mintUniqueKey` / `mintListKey`.
 */
export function requireCardinality(ctor: Ctor, key: MetadataKey): Cardinality {
	const cardinality = getKeyCardinality(key);
	if (cardinality === undefined) {
		throw new UnregisteredMetadataKeyError(ctor as AnyConstructor, key);
	}
	return cardinality;
}

/**
 * Enforces single-value invariant for `"unique"` keys; no-op for `"list"`.
 * Call after the `(ctor, key, ...)` bucket is allocated so `currentLength`
 * reflects the stored count.
 *
 * @throws {DuplicateMetadataError} If `cardinality` is `"unique"` and the slot already holds a value.
 */
export function assertNotDuplicate(
	ctor: Ctor,
	key: MetadataKey,
	cardinality: Cardinality,
	currentLength: number,
	kind: DecoratedKind,
	memberName?: string | symbol
): void {
	if (cardinality === "unique" && currentLength > 0) {
		throw new DuplicateMetadataError(ctor as AnyConstructor, key, cardinality, kind, memberName);
	}
}
