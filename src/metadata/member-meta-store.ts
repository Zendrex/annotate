import { walkPrototypeChain } from "../runtime/prototype-chain";
import { assertNotDuplicate, requireCardinality } from "./append-guards";
import { getOrCreate } from "./get-or-create";
import { chainHasNonEmpty, collectFromChain, firstOnChain, readValues } from "./store-walk";
import type { Ctor, MemberBucket, MemberEntry, MemberKind, MetadataKey } from "./types";

const memberMetaStore = new WeakMap<Ctor, MemberBucket>();

const committedTokens = new WeakMap<Ctor, Set<symbol>>();

/** Any own member metadata on this ctor (no chain walk). */
export function hasOwnAnyMemberMeta(ctor: Ctor): boolean {
	const bucket = memberMetaStore.get(ctor);
	return !!bucket && bucket.size > 0;
}

/** Own member metadata for `ctor`, `key`, and `name` (no prototype walk). */
export function getMemberMeta<TMeta>(ctor: Ctor, key: MetadataKey<TMeta>, name: string | symbol): readonly TMeta[] {
	return readValues<TMeta>(memberMetaStore.get(ctor)?.get(key)?.get(name)?.values) ?? [];
}

/** True if this exact constructor has at least one own value for `(key, name)`. */
export function hasOwnMemberMeta(ctor: Ctor, key: MetadataKey, name: string | symbol): boolean {
	const entry = memberMetaStore.get(ctor)?.get(key)?.get(name);
	return !!entry && entry.values.length > 0;
}

/**
 * Appends own member metadata. No-op if `token` was already committed (idempotent
 * on retry after a partial flush).
 *
 * @throws {UnregisteredMetadataKeyError} If `key` was not minted via `mintUniqueKey` / `mintListKey`.
 * @throws {DuplicateMetadataError} If `key` is `"unique"` and this member already has a value on `ctor`.
 */
export function appendMemberMeta<TMeta>(
	ctor: Ctor,
	key: MetadataKey<TMeta>,
	name: string | symbol,
	meta: TMeta,
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
 * `static` from the most-derived chain link with an entry for `(key, name)`, or `false`
 * (legacy default) if none found. Prefer a `name` known to exist, e.g. from {@link collectMemberNames}.
 */
export function getMemberStatic(ctor: Ctor, key: MetadataKey, name: string | symbol): boolean {
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
export function collectMemberMeta<TMeta>(ctor: Ctor, key: MetadataKey<TMeta>, name: string | symbol): TMeta[] {
	return collectFromChain<TMeta>(ctor, (current) =>
		readValues<TMeta>(memberMetaStore.get(current)?.get(key)?.get(name)?.values)
	);
}

/** Union of member names that have metadata for `key` anywhere in the chain of `ctor`. */
export function collectMemberNames(ctor: Ctor, key: MetadataKey): Set<string | symbol> {
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
 * Merged members under `key` from one chain walk. Per name, values are subclass-first
 * and `static` comes from the most-derived link with data. `values` arrays are fresh copies.
 */
export function snapshotMembers(ctor: Ctor, key: MetadataKey): Map<string | symbol, MemberEntry> {
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
export function firstMemberMetaForKey<TMeta>(
	ctor: Ctor,
	key: MetadataKey<TMeta>,
	name: string | symbol
): TMeta | undefined {
	return firstOnChain<TMeta>(ctor, (current) =>
		readValues<TMeta>(memberMetaStore.get(current)?.get(key)?.get(name)?.values)
	);
}

/** True if any class in the chain has at least one value for `(key, name)`. */
export function hasAnyMemberMetaForKey(ctor: Ctor, key: MetadataKey, name: string | symbol): boolean {
	return chainHasNonEmpty(ctor, (current) => {
		const entry = memberMetaStore.get(current)?.get(key)?.get(name);
		return !!entry && entry.values.length > 0;
	});
}
