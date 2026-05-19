import { DuplicateMetadataError, UnregisteredMetadataKeyError } from "../../errors";
import { getKeyCardinality } from "../cardinality";
import type { AnyConstructor, DecoratedKind } from "../../reflector/types";
import type { Cardinality, Ctor, MetadataKey } from "../types";

export function requireCardinality(ctor: Ctor, key: MetadataKey): Cardinality {
	const cardinality = getKeyCardinality(key);
	if (cardinality === undefined) {
		throw new UnregisteredMetadataKeyError(ctor as AnyConstructor, key);
	}
	return cardinality;
}

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
