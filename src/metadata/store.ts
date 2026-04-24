import { DuplicateMetadataError } from "../errors";
import { walkPrototypeChain } from "../runtime/prototype-chain";
import type { AnyConstructor } from "../reflector/types";
import type { ClassBucket, Ctor, Deferred, MemberBucket, MemberKind } from "./types";

const classMetaStore = new WeakMap<Ctor, ClassBucket>();
const memberMetaStore = new WeakMap<Ctor, MemberBucket>();

// Per-ctor set of already-committed decoration tokens; dedupes eager flush vs.
// lazy-initializer commits for the same decoration site. Spec prescribes
// WeakSet but ES rejects symbol keys there, so Set is used instead.
const committedTokens = new WeakMap<Ctor, Set<symbol>>();

// Static-bit is recorded at decoration time from `context.static` so the
// reflector never needs to probe descriptors (which misfires on built-in
// ctor properties like `name` / `length`).
const memberStaticStore = new WeakMap<Ctor, Map<string | symbol, boolean>>();

const pendingByMetadata: WeakMap<object, Deferred[]> = new WeakMap();
const metadataToCtor: WeakMap<object, Ctor> = new WeakMap();
const ctorToMetadata = new WeakMap<Ctor, object>();

/**
 * Intentional no-op. A global reset is impossible because every store is a
 * WeakMap keyed by class identity; tests must use fresh classes per scenario
 * so entries become unreachable and get collected.
 *
 * @internal
 */
export function _internalReset(): void {
	// No-op by design.
}

export function getClassMeta<T>(ctor: Ctor, key: symbol): readonly T[] {
	return (classMetaStore.get(ctor)?.get(key) as T[] | undefined) ?? [];
}

export function hasOwnClassMeta(ctor: Ctor, key: symbol): boolean {
	const list = classMetaStore.get(ctor)?.get(key);
	return !!list && list.length > 0;
}

/**
 * Append a class-scoped metadata value under `key`.
 *
 * @throws {DuplicateMetadataError} When `options.unique` is true and a value is already registered for `key`.
 */
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
		throw new DuplicateMetadataError(ctor as AnyConstructor, key, "class");
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

/**
 * Append a member-scoped metadata value under `(key, name)`. The `token`
 * dedupes the append against prior commits of the same decoration site, so
 * eager flush and the lazy per-instance initializer can both run safely.
 *
 * @throws {DuplicateMetadataError} When `options.unique` is true and a value is already registered for `(key, name)`.
 */
export function appendMemberMeta<T>(
	ctor: Ctor,
	key: symbol,
	name: string | symbol,
	meta: T,
	token: symbol,
	options: { unique: boolean; static: boolean; kind: MemberKind }
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
		throw new DuplicateMetadataError(ctor as AnyConstructor, key, options.kind, name);
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
 * Resolve the static-bit for `name`, walking the prototype chain so overrides
 * in subclasses shadow the base. Returns `false` when `name` was never
 * registered on any ancestor.
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
 * Collect all metadata values for `(key, name)` across the prototype chain,
 * in subclass-first order. Preserves declaration order within each class.
 */
export function collectMemberMeta<T>(ctor: Ctor, key: symbol, name: string | symbol): T[] {
	const out: T[] = [];
	walkPrototypeChain(ctor, (current) => {
		const list = memberMetaStore.get(current)?.get(key)?.get(name) as T[] | undefined;
		if (list && list.length > 0) {
			out.push(...list);
		}
	});
	return out;
}

/** Collect all class-scoped metadata for `key` across the prototype chain, subclass-first. */
export function collectClassMeta<T>(ctor: Ctor, key: symbol): T[] {
	const out: T[] = [];
	walkPrototypeChain(ctor, (current) => {
		const list = classMetaStore.get(current)?.get(key) as T[] | undefined;
		if (list && list.length > 0) {
			out.push(...list);
		}
	});
	return out;
}

/** Collect every member name decorated under `key` across the prototype chain. */
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

export function hasAnyClassMeta(ctor: Ctor): boolean {
	let found = false;
	walkPrototypeChain(ctor, (current) => {
		const bucket = classMetaStore.get(current);
		if (bucket && bucket.size > 0) {
			found = true;
			return true;
		}
	});
	return found;
}

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
 * Bind `ctor` to its `correlation` bag (both directions). First write wins —
 * later registrations for the same correlation or ctor are ignored so the
 * declaring class remains stable once observed.
 */
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

/**
 * Queue a member registration against a correlation bag whose declaring class
 * is not yet known. Drained by {@link flushFor} once the class is registered,
 * or by the lazy per-instance initializer on first construction.
 */
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

/**
 * Commit every deferred registration buffered under `correlation` onto `ctor`
 * and clear the queue. Safe to call multiple times; committed tokens are
 * deduped inside {@link appendMemberMeta}.
 */
export function flushFor(ctor: Ctor, correlation: object | null): void {
	if (!correlation) {
		return;
	}
	const list = pendingByMetadata.get(correlation);
	if (!list) {
		return;
	}
	for (const d of list) {
		appendMemberMeta(ctor, d.key, d.name, d.meta, d.token, {
			unique: d.unique,
			static: d.static,
			kind: d.kind,
		});
	}
	pendingByMetadata.delete(correlation);
}
