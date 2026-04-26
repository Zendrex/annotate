import { DuplicateMetadataError, UnregisteredMetadataKeyError } from "../errors";
import { walkPrototypeChain } from "../runtime/prototype-chain";
import { getKeyCardinality } from "./cardinality-registry";
import type { AnyConstructor } from "../reflector/types";
import type { Ctor, MemberBucket, MemberKind, MetadataKey } from "./types";

const memberMetaStore = new WeakMap<Ctor, MemberBucket>();

const committedTokens = new WeakMap<Ctor, Set<symbol>>();

const memberStaticStore = new WeakMap<Ctor, Map<string | symbol, boolean>>();

/**
 * Own member metadata for `ctor`, `key`, and `name` (no prototype walk).
 */
export function getMemberMeta<T>(ctor: Ctor, key: symbol, name: string | symbol): readonly T[] {
	return (memberMetaStore.get(ctor)?.get(key)?.get(name) as T[] | undefined) ?? [];
}

/**
 * True if this exact constructor has at least one value for the member+key (own only).
 */
export function hasOwnMemberMeta(ctor: Ctor, key: symbol, name: string | symbol): boolean {
	const list = memberMetaStore.get(ctor)?.get(key)?.get(name);
	return !!list && list.length > 0;
}

/**
 * Appends member metadata. Skips if `token` was already committed for this `ctor` (idempotent re-entry after a partial flush).
 * Cardinality is read from the registry: unregistered keys throw `UnregisteredMetadataKeyError`; unique-registered keys
 * that already have a value for this member throw `DuplicateMetadataError`; list-registered keys accumulate freely.
 *
 * @throws {UnregisteredMetadataKeyError} If `key` was not minted via `mintUniqueKey` or `mintListKey`
 * @throws {DuplicateMetadataError} If the key is `"unique"` and a value already exists for this member+key on `ctor`
 */
export function appendMemberMeta<T>(
	ctor: Ctor,
	key: symbol,
	name: string | symbol,
	meta: T,
	token: symbol,
	options: { static: boolean; kind: MemberKind }
): void {
	const cardinality = getKeyCardinality(key);
	if (cardinality === undefined) {
		throw new UnregisteredMetadataKeyError(ctor as AnyConstructor, key as MetadataKey);
	}

	let tokens = committedTokens.get(ctor);
	if (!tokens) {
		tokens = new Set();
		committedTokens.set(ctor, tokens);
	}
	if (tokens.has(token)) {
		return;
	}

	let outer = memberMetaStore.get(ctor);
	if (!outer) {
		outer = new Map();
		memberMetaStore.set(ctor, outer);
	}
	let inner = outer.get(key);
	if (!inner) {
		inner = new Map();
		outer.set(key, inner);
	}
	let list = inner.get(name);
	if (!list) {
		list = [];
		inner.set(name, list);
	}
	if (cardinality === "unique" && list.length > 0) {
		throw new DuplicateMetadataError(ctor as AnyConstructor, key as MetadataKey, cardinality, options.kind, name);
	}
	list.push(meta);
	tokens.add(token);

	let staticMap = memberStaticStore.get(ctor);
	if (!staticMap) {
		staticMap = new Map();
		memberStaticStore.set(ctor, staticMap);
	}
	staticMap.set(name, options.static);
}

/**
 * Whether the member is static as recorded on the nearest defining class in the prototype chain of `ctor`.
 */
export function getMemberStatic(ctor: Ctor, name: string | symbol): boolean {
	let result = false;
	walkPrototypeChain(ctor, (current) => {
		const map = memberStaticStore.get(current);
		if (map?.has(name)) {
			result = map.get(name) as boolean;
			return true;
		}
	});
	return result;
}

/**
 * All values for this member+key from `ctor` up the chain (subclass first at each level).
 */
export function collectMemberMeta<T>(ctor: Ctor, key: symbol, name: string | symbol): T[] {
	const out: T[] = [];
	walkPrototypeChain(ctor, (current) => {
		const list = memberMetaStore.get(current)?.get(key)?.get(name) as T[] | undefined;
		if (list) {
			for (const item of list) {
				out.push(item);
			}
		}
	});
	return out;
}

/**
 * Union of member names that have metadata for `key` anywhere in the chain of `ctor`.
 */
export function collectMemberNames(ctor: Ctor, key: symbol): Set<string | symbol> {
	const out = new Set<string | symbol>();
	walkPrototypeChain(ctor, (current) => {
		const inner = memberMetaStore.get(current)?.get(key);
		if (inner) {
			for (const name of inner.keys()) {
				out.add(name);
			}
		}
	});
	return out;
}

/**
 * First value for `key`+`name` when walking from `ctor` up the chain.
 */
export function firstMemberMetaForKey<T>(ctor: Ctor, key: symbol, name: string | symbol): T | undefined {
	let result: T | undefined;
	walkPrototypeChain(ctor, (current) => {
		const list = memberMetaStore.get(current)?.get(key)?.get(name) as T[] | undefined;
		if (list && list.length > 0) {
			result = list[0];
			return true;
		}
	});
	return result;
}

/**
 * True if any class in the chain has any member metadata stored.
 */
export function hasAnyMemberMeta(ctor: Ctor): boolean {
	let found = false;
	walkPrototypeChain(ctor, (current) => {
		const bucket = memberMetaStore.get(current);
		if (bucket && bucket.size > 0) {
			found = true;
			return true;
		}
	});
	return found;
}

/**
 * True if any class in the chain has at least one value for this member+key.
 */
export function hasAnyMemberMetaForKey(ctor: Ctor, key: symbol, name: string | symbol): boolean {
	let found = false;
	walkPrototypeChain(ctor, (current) => {
		const list = memberMetaStore.get(current)?.get(key)?.get(name);
		if (list && list.length > 0) {
			found = true;
			return true;
		}
	});
	return found;
}
