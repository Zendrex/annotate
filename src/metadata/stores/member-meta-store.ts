import { walkPrototypeChain } from "../../runtime/prototype-chain";
import { assertNotDuplicate, requireCardinality } from "./append-guards";
import { getOrCreate } from "./get-or-create";
import { chainHasNonEmpty, collectFromChain, firstOnChain, readValues } from "./store-walk";
import type { Ctor, MemberBucket, MemberEntry, MemberKind, MetadataKey } from "../types";

const memberMetaStore = new WeakMap<Ctor, MemberBucket>();

const committedTokens = new WeakMap<Ctor, Set<symbol>>();

export function hasOwnAnyMemberMeta(ctor: Ctor): boolean {
	const bucket = memberMetaStore.get(ctor);
	return !!bucket && bucket.size > 0;
}

export function getMemberMeta<TMeta>(ctor: Ctor, key: MetadataKey<TMeta>, name: string | symbol): readonly TMeta[] {
	return readValues<TMeta>(memberMetaStore.get(ctor)?.get(key)?.get(name)?.values) ?? [];
}

export function hasOwnMemberMeta(ctor: Ctor, key: MetadataKey, name: string | symbol): boolean {
	const entry = memberMetaStore.get(ctor)?.get(key)?.get(name);
	return !!entry && entry.values.length > 0;
}

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

	const byKey = getOrCreate(memberMetaStore, ctor, () => new Map());
	const byMember = getOrCreate(byKey, key, () => new Map());
	const entry: MemberEntry = getOrCreate(byMember, name, () => ({
		kind: options.kind,
		static: options.static,
		values: [],
	}));
	assertNotDuplicate(ctor, key, cardinality, entry.values.length, options.kind, name);
	entry.values.push(meta);
	tokens.add(token);
}

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

export function collectMemberMeta<TMeta>(ctor: Ctor, key: MetadataKey<TMeta>, name: string | symbol): TMeta[] {
	return collectFromChain<TMeta>(ctor, (current) =>
		readValues<TMeta>(memberMetaStore.get(current)?.get(key)?.get(name)?.values)
	);
}

export function collectMemberNames(ctor: Ctor, key: MetadataKey): Set<string | symbol> {
	const out = new Set<string | symbol>();
	walkPrototypeChain(ctor, (current) => {
		const byMember = memberMetaStore.get(current)?.get(key);
		if (byMember) {
			for (const name of byMember.keys()) {
				out.add(name);
			}
		}
	});
	return out;
}

export function snapshotMembers(ctor: Ctor, key: MetadataKey): Map<string | symbol, MemberEntry> {
	const out = new Map<string | symbol, MemberEntry>();
	walkPrototypeChain(ctor, (current) => {
		const byMember = memberMetaStore.get(current)?.get(key);
		if (!byMember) {
			return;
		}
		for (const [name, entry] of byMember) {
			const existing = out.get(name);
			if (existing) {
				// Subclass-first: `kind` and `static` from existing win; superclass values append after.
				for (const value of entry.values) {
					existing.values.push(value);
				}
			} else {
				out.set(name, { kind: entry.kind, static: entry.static, values: [...entry.values] });
			}
		}
	});
	return out;
}

export function firstMemberMetaForKey<TMeta>(
	ctor: Ctor,
	key: MetadataKey<TMeta>,
	name: string | symbol
): TMeta | undefined {
	return firstOnChain<TMeta>(ctor, (current) =>
		readValues<TMeta>(memberMetaStore.get(current)?.get(key)?.get(name)?.values)
	);
}

export function hasAnyMemberMetaForKey(ctor: Ctor, key: MetadataKey, name: string | symbol): boolean {
	return chainHasNonEmpty(ctor, (current) => {
		const entry = memberMetaStore.get(current)?.get(key)?.get(name);
		return !!entry && entry.values.length > 0;
	});
}
