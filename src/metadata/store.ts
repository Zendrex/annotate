import { DuplicateMetadataError, UnregisteredMetadataKeyError } from "../errors";
import { walkPrototypeChain } from "../runtime/prototype-chain";
import { getKeyCardinality } from "./cardinality";
import type { AnyConstructor, DecoratedKind } from "../reflector/types";
import type { Cardinality, ClassBucket, Ctor, MemberBucket, MemberEntry, MemberKind, MetadataKey } from "./types";

export function getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V;
export function getOrCreate<K extends object, V>(map: WeakMap<K, V>, key: K, factory: () => V): V;
export function getOrCreate<K, V>(map: Map<K, V> | WeakMap<K & object, V>, key: K, factory: () => V): V {
	// `has`/`get` instead of an `=== undefined` sentinel so callers may legitimately store `undefined`.
	const concrete = map as Map<K, V>;
	if (!concrete.has(key)) {
		concrete.set(key, factory());
	}
	return concrete.get(key) as V;
}

// Trust boundary: stored values are `unknown[]`; callers project via `MetadataKey<T>`.
function readValues<T>(values: unknown[] | undefined): readonly T[] | undefined {
	return values as T[] | undefined;
}

function chainHasNonEmpty(ctor: Ctor, probe: (current: Ctor) => boolean): boolean {
	let found = false;
	walkPrototypeChain(ctor, (current) => {
		if (probe(current)) {
			found = true;
			return true;
		}
	});
	return found;
}

function firstOnChain<T>(ctor: Ctor, getList: (current: Ctor) => readonly T[] | undefined): T | undefined {
	let result: T | undefined;
	walkPrototypeChain(ctor, (current) => {
		const list = getList(current);
		if (list && list.length > 0) {
			result = list[0];
			return true;
		}
	});
	return result;
}

function collectFromChain<T>(ctor: Ctor, getList: (current: Ctor) => readonly T[] | undefined): T[] {
	const out: T[] = [];
	walkPrototypeChain(ctor, (current) => {
		const list = getList(current);
		if (list) {
			for (const item of list) {
				out.push(item);
			}
		}
	});
	return out;
}

function requireCardinality(ctor: Ctor, key: MetadataKey): Cardinality {
	const cardinality = getKeyCardinality(key);
	if (cardinality === undefined) {
		throw new UnregisteredMetadataKeyError(ctor as AnyConstructor, key);
	}
	return cardinality;
}

function assertNotDuplicate(
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

const classMetaStore = new WeakMap<Ctor, ClassBucket>();
const memberMetaStore = new WeakMap<Ctor, MemberBucket>();
const committedTokens = new WeakMap<Ctor, Set<symbol>>();

export function hasOwnAnyClassMeta(ctor: Ctor): boolean {
	const bucket = classMetaStore.get(ctor);
	return !!bucket && bucket.size > 0;
}

export function hasOwnAnyMemberMeta(ctor: Ctor): boolean {
	const bucket = memberMetaStore.get(ctor);
	return !!bucket && bucket.size > 0;
}

export function getClassMeta<TMeta>(ctor: Ctor, key: MetadataKey<TMeta>): readonly TMeta[] {
	return readValues<TMeta>(classMetaStore.get(ctor)?.get(key)) ?? [];
}

export function hasOwnClassMeta(ctor: Ctor, key: MetadataKey): boolean {
	const list = classMetaStore.get(ctor)?.get(key);
	return !!list && list.length > 0;
}

export function appendClassMeta<TMeta>(ctor: Ctor, key: MetadataKey<TMeta>, value: TMeta): void {
	const cardinality = requireCardinality(ctor, key);
	const bucket = getOrCreate(classMetaStore, ctor, () => new Map());
	const list = getOrCreate(bucket, key, () => []);
	assertNotDuplicate(ctor, key, cardinality, list.length, "class");
	list.push(value);
}

export function collectClassMeta<TMeta>(ctor: Ctor, key: MetadataKey<TMeta>): TMeta[] {
	return collectFromChain<TMeta>(ctor, (current) => readValues<TMeta>(classMetaStore.get(current)?.get(key)));
}

export function firstClassMetaForKey<TMeta>(ctor: Ctor, key: MetadataKey<TMeta>): TMeta | undefined {
	return firstOnChain<TMeta>(ctor, (current) => readValues<TMeta>(classMetaStore.get(current)?.get(key)));
}

export function hasAnyClassMetaForKey(ctor: Ctor, key: MetadataKey): boolean {
	return chainHasNonEmpty(ctor, (current) => {
		const list = classMetaStore.get(current)?.get(key);
		return !!list && list.length > 0;
	});
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

export function hasAnyMeta(ctor: Ctor): boolean {
	return chainHasNonEmpty(ctor, (current) => hasOwnAnyClassMeta(current) || hasOwnAnyMemberMeta(current));
}
