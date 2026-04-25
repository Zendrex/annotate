import { DuplicateMetadataError, UnregisteredMetadataKeyError } from "../errors";
import { walkPrototypeChain } from "../runtime/prototype-chain";
import { getKeyCardinality } from "./cardinality-registry";
import type { AnyConstructor } from "../reflector/types";
import type { ClassBucket, Ctor, MetadataKey } from "./types";

const classMetaStore = new WeakMap<Ctor, ClassBucket>();

/**
 * Own class-level metadata for `ctor` and `key` only (no prototype walk).
 */
export function getClassMeta<T>(ctor: Ctor, key: symbol): readonly T[] {
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

	let bucket = classMetaStore.get(ctor);
	if (!bucket) {
		bucket = new Map();
		classMetaStore.set(ctor, bucket);
	}
	let list = bucket.get(key);
	if (!list) {
		list = [];
		bucket.set(key, list);
	}
	if (cardinality === "unique" && list.length > 0) {
		// key is plain symbol here; cast to MetadataKey for the structured error (brand is phantom-only).
		throw new DuplicateMetadataError(ctor as AnyConstructor, key as MetadataKey, "class");
	}
	list.push(value);
}

/**
 * Gathers all values for `key` from `ctor` up the prototype chain, subclass first (own on each level, then super).
 */
export function collectClassMeta<T>(ctor: Ctor, key: symbol): T[] {
	const out: T[] = [];
	walkPrototypeChain(ctor, (current) => {
		const list = classMetaStore.get(current)?.get(key) as T[] | undefined;
		if (list) {
			for (const item of list) {
				out.push(item);
			}
		}
	});
	return out;
}

/**
 * True if any class in the prototype chain of `ctor` has any class-level metadata in the store.
 */
export function hasAnyClassMeta(ctor: Ctor): boolean {
	let found = false;
	walkPrototypeChain(ctor, (current) => {
		const bucket = classMetaStore.get(current);
		if (bucket && bucket.size > 0) {
			found = true;
			return true;
		}
	});
	return found;
}

/**
 * First value for `key` found when walking from `ctor` up the chain (subclass before superclass).
 */
export function firstClassMetaForKey<T>(ctor: Ctor, key: symbol): T | undefined {
	let result: T | undefined;
	walkPrototypeChain(ctor, (current) => {
		const list = classMetaStore.get(current)?.get(key) as T[] | undefined;
		if (list && list.length > 0) {
			result = list[0];
			return true;
		}
	});
	return result;
}

/**
 * True if any class in the chain has at least one own value for `key`.
 */
export function hasAnyClassMetaForKey(ctor: Ctor, key: symbol): boolean {
	let found = false;
	walkPrototypeChain(ctor, (current) => {
		const list = classMetaStore.get(current)?.get(key);
		if (list && list.length > 0) {
			found = true;
			return true;
		}
	});
	return found;
}
