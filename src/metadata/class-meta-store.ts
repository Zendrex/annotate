import { assertNotDuplicate, requireCardinality } from "./append-guards";
import { getOrCreate } from "./get-or-create";
import { chainHasNonEmpty, collectFromChain, firstOnChain, readValues } from "./store-walk";
import type { ClassBucket, Ctor, MetadataKey } from "./types";

const classMetaStore = new WeakMap<Ctor, ClassBucket>();

/** Any own class metadata on this ctor (no chain walk). Used by `hasAnyMeta`. */
export function hasOwnAnyClassMeta(ctor: Ctor): boolean {
	const bucket = classMetaStore.get(ctor);
	return !!bucket && bucket.size > 0;
}

/** Own class-level metadata for `ctor` and `key` (no prototype walk). */
export function getClassMeta<TMeta>(ctor: Ctor, key: MetadataKey<TMeta>): readonly TMeta[] {
	return readValues<TMeta>(classMetaStore.get(ctor)?.get(key)) ?? [];
}

/** True if this exact constructor has at least one own value for `key`. */
export function hasOwnClassMeta(ctor: Ctor, key: MetadataKey): boolean {
	const list = classMetaStore.get(ctor)?.get(key);
	return !!list && list.length > 0;
}

/**
 * Appends a class-level value for `key` on `ctor`.
 *
 * @throws {UnregisteredMetadataKeyError} If `key` was not minted via `mintUniqueKey` or `mintListKey`.
 * @throws {DuplicateMetadataError} If the key is `"unique"` and a value already exists for this ctor+key.
 */
export function appendClassMeta<TMeta>(ctor: Ctor, key: MetadataKey<TMeta>, value: TMeta): void {
	const cardinality = requireCardinality(ctor, key);
	const bucket = getOrCreate(classMetaStore, ctor, () => new Map());
	const list = getOrCreate(bucket, key, () => []);
	assertNotDuplicate(ctor, key, cardinality, list.length, "class");
	list.push(value);
}

/** Gathers values for `key` from `ctor` up the chain, subclass first. */
export function collectClassMeta<TMeta>(ctor: Ctor, key: MetadataKey<TMeta>): TMeta[] {
	return collectFromChain<TMeta>(ctor, (current) => readValues<TMeta>(classMetaStore.get(current)?.get(key)));
}

/** First value for `key` found walking from `ctor` up the chain (subclass before superclass). */
export function firstClassMetaForKey<TMeta>(ctor: Ctor, key: MetadataKey<TMeta>): TMeta | undefined {
	return firstOnChain<TMeta>(ctor, (current) => readValues<TMeta>(classMetaStore.get(current)?.get(key)));
}

/** True if any class in the chain has at least one own value for `key`. */
export function hasAnyClassMetaForKey(ctor: Ctor, key: MetadataKey): boolean {
	return chainHasNonEmpty(ctor, (current) => {
		const list = classMetaStore.get(current)?.get(key);
		return !!list && list.length > 0;
	});
}
