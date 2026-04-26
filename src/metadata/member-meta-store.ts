import { DuplicateMetadataError, UnregisteredMetadataKeyError } from "../errors";
import { walkPrototypeChain } from "../runtime/prototype-chain";
import { getKeyCardinality } from "./cardinality-registry";
import { getOrCreate } from "./get-or-create";
import { chainHasNonEmpty, collectFromChain, firstOnChain } from "./store-walk";
import type { AnyConstructor } from "../reflector/types";
import type { Ctor, MemberBucket, MemberEntry, MemberKind, MetadataKey } from "./types";

const memberMetaStore = new WeakMap<Ctor, MemberBucket>();

const committedTokens = new WeakMap<Ctor, Set<symbol>>();

/**
 * Probe used by `hasAnyMeta` to ask "does this exact constructor link have any
 * member metadata?" without walking the prototype chain. Exported only for the
 * combined chain walk in {@link hasAnyMeta}.
 */
export function hasOwnAnyMemberMeta(ctor: Ctor): boolean {
	const bucket = memberMetaStore.get(ctor);
	return !!bucket && bucket.size > 0;
}

/**
 * Own member metadata for `ctor`, `key`, and `name` (no prototype walk).
 */
export function getMemberMeta<T>(ctor: Ctor, key: symbol, name: string | symbol): readonly T[] {
	// safe: T is the caller's narrowed view of the unknown[] stored internally
	return (memberMetaStore.get(ctor)?.get(key)?.get(name)?.values as T[] | undefined) ?? [];
}

/**
 * True if this exact constructor has at least one value for the member+key (own only).
 */
export function hasOwnMemberMeta(ctor: Ctor, key: symbol, name: string | symbol): boolean {
	const entry = memberMetaStore.get(ctor)?.get(key)?.get(name);
	return !!entry && entry.values.length > 0;
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

	const tokens = getOrCreate(committedTokens, ctor, () => new Set());
	if (tokens.has(token)) {
		return;
	}

	const outer = getOrCreate(memberMetaStore, ctor, () => new Map());
	const inner = getOrCreate(outer, key, () => new Map());
	const entry: MemberEntry = getOrCreate(inner, name, () => ({ values: [], static: options.static }));
	if (cardinality === "unique" && entry.values.length > 0) {
		throw new DuplicateMetadataError(ctor as AnyConstructor, key as MetadataKey, cardinality, options.kind, name);
	}
	entry.values.push(meta);
	tokens.add(token);
}

/**
 * Whether the member is static as recorded on the nearest class in the prototype chain
 * of `ctor` that has an entry for the given `(key, name)` pair.
 *
 * Caller must pass a `key` for which the member is known to have an entry somewhere
 * in the chain — typically a name yielded by {@link collectMemberNames}. Returns
 * `false` if no entry is found, matching the historical default.
 */
export function getMemberStatic(ctor: Ctor, key: symbol, name: string | symbol): boolean {
	let result = false;
	walkPrototypeChain(ctor, (current) => {
		const entry = memberMetaStore.get(current)?.get(key)?.get(name);
		if (entry) {
			result = entry.static;
			return true;
		}
	});
	return result;
}

/**
 * All values for this member+key from `ctor` up the chain (subclass first at each level).
 */
export function collectMemberMeta<T>(ctor: Ctor, key: symbol, name: string | symbol): T[] {
	return collectFromChain<T>(
		ctor,
		(current) => memberMetaStore.get(current)?.get(key)?.get(name)?.values as T[] | undefined
	);
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
 * One-pass chain walk for all members under `key` on `ctor`. Returns a map
 * from member name to a {@link MemberEntry} whose `values` is the chain-merged
 * list (subclass first) and whose `static` flag matches the most-derived link
 * that has an entry for that name.
 *
 * The returned `values` arrays are fresh copies — mutating them does not
 * affect the underlying store. This consolidates what would otherwise be
 * three separate chain walks per member (`collectMemberNames` +
 * `collectMemberMeta` + `getMemberStatic`) into a single pass.
 */
export function snapshotMembers(ctor: Ctor, key: symbol): Map<string | symbol, MemberEntry> {
	const out = new Map<string | symbol, MemberEntry>();
	walkPrototypeChain(ctor, (current) => {
		const inner = memberMetaStore.get(current)?.get(key);
		if (!inner) {
			return;
		}
		for (const [name, entry] of inner) {
			const existing = out.get(name);
			if (existing) {
				// Subclass-first order: existing wins for `static`; superclass values appended after.
				for (const value of entry.values) {
					existing.values.push(value);
				}
			} else {
				out.set(name, { static: entry.static, values: [...entry.values] });
			}
		}
	});
	return out;
}

/**
 * First value for `key`+`name` when walking from `ctor` up the chain.
 */
export function firstMemberMetaForKey<T>(ctor: Ctor, key: symbol, name: string | symbol): T | undefined {
	return firstOnChain<T>(
		ctor,
		(current) => memberMetaStore.get(current)?.get(key)?.get(name)?.values as T[] | undefined
	);
}

/**
 * True if any class in the chain has at least one value for this member+key.
 */
export function hasAnyMemberMetaForKey(ctor: Ctor, key: symbol, name: string | symbol): boolean {
	return chainHasNonEmpty(ctor, (current) => {
		const entry = memberMetaStore.get(current)?.get(key)?.get(name);
		return !!entry && entry.values.length > 0;
	});
}
