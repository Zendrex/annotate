import { DuplicateMetadataError } from "../errors";
import type { ClassBucket, Deferred, MemberBucket } from "./types";

// biome-ignore lint/complexity/noBannedTypes: Store API accepts raw constructor identity for WeakMap parity; aliased once to avoid suppression noise throughout this file.
type Ctor = Function;

const classMetaStore = new WeakMap<Ctor, ClassBucket>();
const memberMetaStore = new WeakMap<Ctor, MemberBucket>();

// Spec writes WeakSet; ES forbids symbol WeakSet keys, so we use Set. Tokens are short-lived per decoration batch.
const committedTokens = new WeakMap<Ctor, Set<symbol>>();

const pendingByMetadata: WeakMap<object, Deferred[]> = new WeakMap();
const metadataToCtor: WeakMap<object, Ctor> = new WeakMap();
const ctorToMetadata = new WeakMap<Ctor, object>();

export function _internalReset(): void {
	// Test-only reset hook is not provided — WeakMaps cannot be enumerated.
	// Tests must use fresh classes per scenario; class identity is the GC root.
}

export function getClassMeta<T>(ctor: Ctor, key: symbol): readonly T[] {
	return (classMetaStore.get(ctor)?.get(key) as T[] | undefined) ?? [];
}

export function hasOwnClassMeta(ctor: Ctor, key: symbol): boolean {
	const list = classMetaStore.get(ctor)?.get(key);
	return !!list && list.length > 0;
}

export function appendClassMeta<T>(ctor: Ctor, key: symbol, value: T, options: { unique: boolean }): void {
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
	if (options.unique && list.length > 0) {
		throw new DuplicateMetadataError(ctor as new (...args: unknown[]) => unknown, key, "class");
	}
	list.push(value);
}

export function getMemberMeta<T>(ctor: Ctor, key: symbol, name: string | symbol): readonly T[] {
	return (memberMetaStore.get(ctor)?.get(key)?.get(name) as T[] | undefined) ?? [];
}

export function hasOwnMemberMeta(ctor: Ctor, key: symbol, name: string | symbol): boolean {
	const list = memberMetaStore.get(ctor)?.get(key)?.get(name);
	return !!list && list.length > 0;
}

export function appendMemberMeta<T>(
	ctor: Ctor,
	key: symbol,
	name: string | symbol,
	meta: T,
	token: symbol,
	options: { unique: boolean }
): void {
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
	if (options.unique && list.length > 0) {
		throw new DuplicateMetadataError(ctor as new (...args: unknown[]) => unknown, key, "method", name);
	}
	list.push(meta);
	tokens.add(token);
}

export function collectMemberMeta<T>(ctor: Ctor, key: symbol, name: string | symbol): T[] {
	const out: T[] = [];
	let current: Ctor | null = ctor;
	while (current && current !== Function.prototype) {
		const list = memberMetaStore.get(current)?.get(key)?.get(name) as T[] | undefined;
		if (list && list.length > 0) {
			out.push(...list);
		}
		current = Object.getPrototypeOf(current) as Ctor | null;
	}
	return out;
}

export function collectClassMeta<T>(ctor: Ctor, key: symbol): T[] {
	const out: T[] = [];
	let current: Ctor | null = ctor;
	while (current && current !== Function.prototype) {
		const list = classMetaStore.get(current)?.get(key) as T[] | undefined;
		if (list && list.length > 0) {
			out.push(...list);
		}
		current = Object.getPrototypeOf(current) as Ctor | null;
	}
	return out;
}

export function collectMemberNames(ctor: Ctor, key: symbol): Set<string | symbol> {
	const out = new Set<string | symbol>();
	let current: Ctor | null = ctor;
	while (current && current !== Function.prototype) {
		const inner = memberMetaStore.get(current)?.get(key);
		if (inner) {
			for (const name of inner.keys()) {
				out.add(name);
			}
		}
		current = Object.getPrototypeOf(current) as Ctor | null;
	}
	return out;
}

export function hasAnyClassMeta(ctor: Ctor): boolean {
	let current: Ctor | null = ctor;
	while (current && current !== Function.prototype) {
		const bucket = classMetaStore.get(current);
		if (bucket && bucket.size > 0) {
			return true;
		}
		current = Object.getPrototypeOf(current) as Ctor | null;
	}
	return false;
}

export function hasAnyMemberMeta(ctor: Ctor): boolean {
	let current: Ctor | null = ctor;
	while (current && current !== Function.prototype) {
		const bucket = memberMetaStore.get(current);
		if (bucket && bucket.size > 0) {
			return true;
		}
		current = Object.getPrototypeOf(current) as Ctor | null;
	}
	return false;
}

export function registerCtor(ctor: Ctor, correlation: object | null): void {
	if (!correlation) {
		return;
	}
	if (!metadataToCtor.has(correlation)) {
		metadataToCtor.set(correlation, ctor);
	}
	if (!ctorToMetadata.has(ctor)) {
		ctorToMetadata.set(ctor, correlation);
	}
}

export function resolveCtorFromMetadata(correlation: object): Ctor | undefined {
	return metadataToCtor.get(correlation);
}

export function getCorrelationFor(ctor: Ctor): object | undefined {
	return ctorToMetadata.get(ctor);
}

export function queueDeferred(correlation: object | null, deferred: Deferred): void {
	if (!correlation) {
		return;
	}
	let list = pendingByMetadata.get(correlation);
	if (!list) {
		list = [];
		pendingByMetadata.set(correlation, list);
	}
	list.push(deferred);
}

export function hasPendingFor(correlation: object): boolean {
	return pendingByMetadata.has(correlation);
}

export function flushFor(ctor: Ctor, correlation: object | null): void {
	if (!correlation) {
		return;
	}
	const list = pendingByMetadata.get(correlation);
	if (!list) {
		return;
	}
	for (const d of list) {
		appendMemberMeta(ctor, d.key, d.name, d.meta, d.token, { unique: d.unique });
	}
	pendingByMetadata.delete(correlation);
}
