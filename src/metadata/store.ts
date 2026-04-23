import { DuplicateMetadataError } from "../errors";
import type { ClassBucket, Deferred, MemberBucket } from "./types";

// biome-ignore lint/complexity/noBannedTypes: WeakMap key requires Function for constructor identity.
const classMetaStore = new WeakMap<Function, ClassBucket>();

// biome-ignore lint/complexity/noBannedTypes: WeakMap key requires Function for constructor identity.
// biome-ignore lint/correctness/noUnusedVariables: Scaffold storage — populated in Phase C2-C5.
const memberMetaStore = new WeakMap<Function, MemberBucket>();

// Spec writes WeakSet; ES forbids symbol WeakSet keys, so we use Set. Tokens are short-lived per decoration batch.
// biome-ignore lint/complexity/noBannedTypes: WeakMap key requires Function for constructor identity.
// biome-ignore lint/correctness/noUnusedVariables: Scaffold storage — populated in Phase C2-C5.
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
export function getClassMeta<T>(ctor: Function, key: symbol): T[] {
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
