import { DuplicateMetadataError, UnregisteredMetadataKeyError } from "../errors";
import { getKeyCardinality } from "./cardinality-registry";
import { getOrCreate } from "./get-or-create";
import { chainHasNonEmpty, collectFromChain, firstOnChain } from "./store-walk";
import type { AnyConstructor } from "../reflector/types";
import type { ClassBucket, Ctor, MetadataKey } from "./types";

const classMetaStore = new WeakMap<Ctor, ClassBucket>();

/**
 * Probe used by `hasAnyMeta` to ask "does this exact constructor link have any
 * class metadata?" without walking the prototype chain. Exported only for the
 * combined chain walk in {@link "./has-any-meta"}.
 */
export function hasOwnAnyClassMeta(ctor: Ctor): boolean {
	const bucket = classMetaStore.get(ctor);
	return !!bucket && bucket.size > 0;
}

/**
 * Own class-level metadata for `ctor` and `key` only (no prototype walk).
 */
export function getClassMeta<T>(ctor: Ctor, key: symbol): readonly T[] {
	// safe: T is the caller's narrowed view of the unknown[] stored internally
	return (classMetaStore.get(ctor)?.get(key) as T[] | undefined) ?? [];
}

/**
 * True if this exact constructor has at least one value for `key` (own entries only).
 */
export function hasOwnClassMeta(ctor: Ctor, key: symbol): boolean {
	const list = classMetaStore.get(ctor)?.get(key);
	return !!list && list.length > 0;
}

/**
 * Appends a class-level value for `key` on `ctor`. Cardinality is read from the registry:
 * unregistered keys throw `UnregisteredMetadataKeyError`; unique-registered keys that already
 * have a value throw `DuplicateMetadataError`; list-registered keys accumulate freely.
 *
 * @throws {UnregisteredMetadataKeyError} If `key` was not minted via `mintUniqueKey` or `mintListKey`
 * @throws {DuplicateMetadataError} If the key is `"unique"` and a value already exists for this ctor+key
 */
export function appendClassMeta<T>(ctor: Ctor, key: symbol, value: T): void {
	const cardinality = getKeyCardinality(key);
	if (cardinality === undefined) {
		throw new UnregisteredMetadataKeyError(ctor as AnyConstructor, key as MetadataKey);
	}

	const bucket = getOrCreate(classMetaStore, ctor, () => new Map());
	const list = getOrCreate(bucket, key, () => []);
	if (cardinality === "unique" && list.length > 0) {
		throw new DuplicateMetadataError(ctor as AnyConstructor, key as MetadataKey, cardinality, "class");
	}
	list.push(value);
}

/**
 * Gathers all values for `key` from `ctor` up the prototype chain, subclass first (own on each level, then super).
 */
export function collectClassMeta<T>(ctor: Ctor, key: symbol): T[] {
	return collectFromChain<T>(ctor, (current) => classMetaStore.get(current)?.get(key) as T[] | undefined);
}

/**
 * First value for `key` found when walking from `ctor` up the chain (subclass before superclass).
 */
export function firstClassMetaForKey<T>(ctor: Ctor, key: symbol): T | undefined {
	return firstOnChain<T>(ctor, (current) => classMetaStore.get(current)?.get(key) as T[] | undefined);
}

/**
 * True if any class in the chain has at least one own value for `key`.
 */
export function hasAnyClassMetaForKey(ctor: Ctor, key: symbol): boolean {
	return chainHasNonEmpty(ctor, (current) => {
		const list = classMetaStore.get(current)?.get(key);
		return !!list && list.length > 0;
	});
}
