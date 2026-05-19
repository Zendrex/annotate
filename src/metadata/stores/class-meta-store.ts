import { assertNotDuplicate, requireCardinality } from "./append-guards";
import { getOrCreate } from "./get-or-create";
import { chainHasNonEmpty, collectFromChain, firstOnChain, readValues } from "./store-walk";
import type { ClassBucket, Ctor, MetadataKey } from "../types";

const classMetaStore = new WeakMap<Ctor, ClassBucket>();

export function hasOwnAnyClassMeta(ctor: Ctor): boolean {
	const bucket = classMetaStore.get(ctor);
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
