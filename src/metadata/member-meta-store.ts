import { walkPrototypeChain } from "../runtime/prototype-chain";
import { assertNotDuplicate, requireCardinality } from "./append-guards";
import { getOrCreate } from "./get-or-create";
import { chainHasNonEmpty, collectFromChain, firstOnChain, readValues } from "./store-walk";
import type { Ctor, MemberBucket, MemberEntry, MemberKind } from "./types";

const memberMetaStore = new WeakMap<Ctor, MemberBucket>();

const committedTokens = new WeakMap<Ctor, Set<symbol>>();

/** Probe used by `hasAnyMeta` to ask whether this exact ctor link has any member metadata (no chain walk). */
export function hasOwnAnyMemberMeta(ctor: Ctor): boolean {
	const bucket = memberMetaStore.get(ctor);
	return !!bucket && bucket.size > 0;
}

/** Own member metadata for `ctor`, `key`, and `name` (no prototype walk). */
export function getMemberMeta<T>(ctor: Ctor, key: symbol, name: string | symbol): readonly T[] {
	return readValues<T>(memberMetaStore.get(ctor)?.get(key)?.get(name)?.values) ?? [];
}

/** True if this exact constructor has at least one own value for `(key, name)`. */
export function hasOwnMemberMeta(ctor: Ctor, key: symbol, name: string | symbol): boolean {
	const entry = memberMetaStore.get(ctor)?.get(key)?.get(name);
	return !!entry && entry.values.length > 0;
}

/**
 * Appends member metadata. Skips if `token` was already committed for this
 * `ctor` (idempotent re-entry after a partial flush).
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
	const cardinality = requireCardinality(ctor, key);

	const tokens = getOrCreate(committedTokens, ctor, () => new Set());
	if (tokens.has(token)) {
		return;
	}

	const outer = getOrCreate(memberMetaStore, ctor, () => new Map());
	const inner = getOrCreate(outer, key, () => new Map());
	const entry: MemberEntry = getOrCreate(inner, name, () => ({ values: [], static: options.static }));
	assertNotDuplicate(ctor, key, cardinality, entry.values.length, options.kind, name);
	entry.values.push(meta);
	tokens.add(token);
}

/**
 * Static flag recorded on the nearest chain link with an entry for `(key, name)`.
 * Caller must pass a `name` known to exist (e.g. yielded by {@link collectMemberNames}).
 * Returns `false` if no entry is found, matching the historical default.
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

/** All values for `(key, name)` from `ctor` up the chain (subclass first at each level). */
export function collectMemberMeta<T>(ctor: Ctor, key: symbol, name: string | symbol): T[] {
	return collectFromChain<T>(ctor, (current) =>
		readValues<T>(memberMetaStore.get(current)?.get(key)?.get(name)?.values)
	);
}

/** Union of member names that have metadata for `key` anywhere in the chain of `ctor`. */
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
 * One-pass chain walk for all members under `key` on `ctor`. Replaces three
 * separate walks (`collectMemberNames` + `collectMemberMeta` + `getMemberStatic`)
 * with a single traversal. `values` arrays in the result are fresh copies; the
 * `static` flag matches the most-derived link with an entry for each name.
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
				// Subclass-first: `static` from existing wins; superclass values appended after.
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

/** First value for `(key, name)` walking from `ctor` up the chain. */
export function firstMemberMetaForKey<T>(ctor: Ctor, key: symbol, name: string | symbol): T | undefined {
	return firstOnChain<T>(ctor, (current) => readValues<T>(memberMetaStore.get(current)?.get(key)?.get(name)?.values));
}

/** True if any class in the chain has at least one value for `(key, name)`. */
export function hasAnyMemberMetaForKey(ctor: Ctor, key: symbol, name: string | symbol): boolean {
	return chainHasNonEmpty(ctor, (current) => {
		const entry = memberMetaStore.get(current)?.get(key)?.get(name);
		return !!entry && entry.values.length > 0;
	});
}
