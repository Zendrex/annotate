import { assertNotDuplicate, requireCardinality } from "./append-guards";
import { getOrCreate } from "./get-or-create";
import { chainHasNonEmpty, collectFromChain, firstOnChain, readValues } from "./store-walk";
import type { ClassBucket, Ctor } from "./types";

const classMetaStore = new WeakMap<Ctor, ClassBucket>();

/** Probe used by `hasAnyMeta` to ask whether this exact ctor link has any class metadata (no chain walk). */
export function hasOwnAnyClassMeta(ctor: Ctor): boolean {
	const bucket = classMetaStore.get(ctor);
	return !!bucket && bucket.size > 0;
}

/** Own class-level metadata for `ctor` and `key` (no prototype walk). */
export function getClassMeta<T>(ctor: Ctor, key: symbol): readonly T[] {
	return readValues<T>(classMetaStore.get(ctor)?.get(key)) ?? [];
}

/** True if this exact constructor has at least one own value for `key`. */
export function hasOwnClassMeta(ctor: Ctor, key: symbol): boolean {
	const list = classMetaStore.get(ctor)?.get(key);
	return !!list && list.length > 0;
}

/**
 * Appends a class-level value for `key` on `ctor`.
 *
 * @throws {UnregisteredMetadataKeyError} If `key` was not minted via `mintUniqueKey` or `mintListKey`
 * @throws {DuplicateMetadataError} If the key is `"unique"` and a value already exists for this ctor+key
 */
export function appendClassMeta<T>(ctor: Ctor, key: symbol, value: T): void {
	const cardinality = requireCardinality(ctor, key);
	const bucket = getOrCreate(classMetaStore, ctor, () => new Map());
	const list = getOrCreate(bucket, key, () => []);
	assertNotDuplicate(ctor, key, cardinality, list.length, "class");
	list.push(value);
}

/** Gathers values for `key` from `ctor` up the chain, subclass first. */
export function collectClassMeta<T>(ctor: Ctor, key: symbol): T[] {
	return collectFromChain<T>(ctor, (current) => readValues<T>(classMetaStore.get(current)?.get(key)));
}

/** First value for `key` found walking from `ctor` up the chain (subclass before superclass). */
export function firstClassMetaForKey<T>(ctor: Ctor, key: symbol): T | undefined {
	return firstOnChain<T>(ctor, (current) => readValues<T>(classMetaStore.get(current)?.get(key)));
}

/** True if any class in the chain has at least one own value for `key`. */
export function hasAnyClassMetaForKey(ctor: Ctor, key: symbol): boolean {
	return chainHasNonEmpty(ctor, (current) => {
		const list = classMetaStore.get(current)?.get(key);
		return !!list && list.length > 0;
	});
}
