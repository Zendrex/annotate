import { DuplicateMetadataError } from "../errors";
import type { ClassBucket, Deferred, MemberBucket } from "./types";

// biome-ignore lint/complexity/noBannedTypes: WeakMap key requires Function for constructor identity.
const classMetaStore = new WeakMap<Function, ClassBucket>();

// biome-ignore lint/complexity/noBannedTypes: WeakMap key requires Function for constructor identity.
const memberMetaStore = new WeakMap<Function, MemberBucket>();

// Spec writes WeakSet; ES forbids symbol WeakSet keys, so we use Set. Tokens are short-lived per decoration batch.
// biome-ignore lint/complexity/noBannedTypes: WeakMap key requires Function for constructor identity.
const committedTokens = new WeakMap<Function, Set<symbol>>();

// biome-ignore lint/correctness/noUnusedVariables: Scaffold storage — populated in Phase C2-C5.
const pendingByMetadata: WeakMap<object, Deferred[]> = new WeakMap();

// biome-ignore lint/complexity/noBannedTypes: WeakMap value stores constructor references for reverse lookup.
// biome-ignore lint/correctness/noUnusedVariables: Scaffold storage — populated in Phase C2-C5.
const metadataToCtor: WeakMap<object, Function> = new WeakMap();

// biome-ignore lint/complexity/noBannedTypes: WeakMap key requires Function for constructor identity.
// biome-ignore lint/correctness/noUnusedVariables: Scaffold storage — populated in Phase C2-C5.
const ctorToMetadata = new WeakMap<Function, object>();

export function _internalReset(): void {
	// Test-only reset hook is not provided — WeakMaps cannot be enumerated.
	// Tests must use fresh classes per scenario; class identity is the GC root.
}

// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
export function getClassMeta<T>(ctor: Function, key: symbol): readonly T[] {
	return (classMetaStore.get(ctor)?.get(key) as T[] | undefined) ?? [];
}

// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
export function hasOwnClassMeta(ctor: Function, key: symbol): boolean {
	const list = classMetaStore.get(ctor)?.get(key);
	return !!list && list.length > 0;
}

// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
export function appendClassMeta<T>(ctor: Function, key: symbol, value: T, options: { unique: boolean }): void {
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

// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
export function getMemberMeta<T>(ctor: Function, key: symbol, name: string | symbol): readonly T[] {
	return (memberMetaStore.get(ctor)?.get(key)?.get(name) as T[] | undefined) ?? [];
}

// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
export function hasOwnMemberMeta(ctor: Function, key: symbol, name: string | symbol): boolean {
	const list = memberMetaStore.get(ctor)?.get(key)?.get(name);
	return !!list && list.length > 0;
}

export function appendMemberMeta<T>(
	// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
	ctor: Function,
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

// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
export function collectMemberMeta<T>(ctor: Function, key: symbol, name: string | symbol): T[] {
	const out: T[] = [];
	// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
	let current: Function | null = ctor;
	while (current && current !== Function.prototype) {
		const list = memberMetaStore.get(current)?.get(key)?.get(name) as T[] | undefined;
		if (list && list.length > 0) {
			out.push(...list);
		}
		// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
		current = Object.getPrototypeOf(current) as Function | null;
	}
	return out;
}

// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
export function collectClassMeta<T>(ctor: Function, key: symbol): T[] {
	const out: T[] = [];
	// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
	let current: Function | null = ctor;
	while (current && current !== Function.prototype) {
		const list = classMetaStore.get(current)?.get(key) as T[] | undefined;
		if (list && list.length > 0) {
			out.push(...list);
		}
		// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
		current = Object.getPrototypeOf(current) as Function | null;
	}
	return out;
}

// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
export function collectMemberNames(ctor: Function, key: symbol): Set<string | symbol> {
	const out = new Set<string | symbol>();
	// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
	let current: Function | null = ctor;
	while (current && current !== Function.prototype) {
		const inner = memberMetaStore.get(current)?.get(key);
		if (inner) {
			for (const name of inner.keys()) {
				out.add(name);
			}
		}
		// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
		current = Object.getPrototypeOf(current) as Function | null;
	}
	return out;
}

// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
export function hasAnyClassMeta(ctor: Function): boolean {
	// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
	let current: Function | null = ctor;
	while (current && current !== Function.prototype) {
		const bucket = classMetaStore.get(current);
		if (bucket && bucket.size > 0) {
			return true;
		}
		// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
		current = Object.getPrototypeOf(current) as Function | null;
	}
	return false;
}

// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
export function hasAnyMemberMeta(ctor: Function): boolean {
	// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
	let current: Function | null = ctor;
	while (current && current !== Function.prototype) {
		const bucket = memberMetaStore.get(current);
		if (bucket && bucket.size > 0) {
			return true;
		}
		// biome-ignore lint/complexity/noBannedTypes: store API accepts raw constructor identity for cross-file WeakMap parity.
		current = Object.getPrototypeOf(current) as Function | null;
	}
	return false;
}
