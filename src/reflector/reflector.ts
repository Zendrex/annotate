import { UnregisteredClassError } from "../errors";
import { getKeyCardinality } from "../metadata/cardinality-registry";
import { collectClassMeta, hasAnyClassMeta } from "../metadata/class-meta-store";
import {
	collectMemberMeta,
	collectMemberNames,
	getMemberStatic,
	hasAnyMemberMeta,
} from "../metadata/member-meta-store";
import { prepare } from "../runtime/prepare";
import { targetDisplayName } from "./class-name";
import { resolveReflectTarget } from "./resolve-instance";
import type { Ctor, ListMetadataKey, MetadataKey, UniqueMetadataKey } from "../metadata/types";
import type {
	AnyConstructor,
	DecoratedClass,
	DecoratedClassList,
	DecoratedClassUnique,
	DecoratedItem,
	DecoratedMethod,
	DecoratedMethodList,
	DecoratedMethodUnique,
	DecoratedProperty,
	DecoratedPropertyList,
	DecoratedPropertyUnique,
} from "./types";

/**
 * Read view over all decoration for a class constructor. Queries are lazy:
 * the first call runs {@link prepare} and fails with {@link UnregisteredClassError}
 * if no metadata is registered for the class.
 *
 * All key parameters must be branded: minted via `mintUniqueKey` or `mintListKey`.
 * Bare `symbol` and unbranded `MetadataKey<T>` are no longer accepted.
 */
export interface Reflector {
	all<T>(key: UniqueMetadataKey<T>): DecoratedItem<T, "unique">[];
	all<T>(key: ListMetadataKey<T>): DecoratedItem<T, "list">[];
	class<T>(key: UniqueMetadataKey<T>): DecoratedClassUnique<T> | undefined;
	class<T>(key: ListMetadataKey<T>): DecoratedClassList<T> | undefined;
	methods<T>(key: UniqueMetadataKey<T>): DecoratedMethodUnique<T>[];
	methods<T>(key: ListMetadataKey<T>): DecoratedMethodList<T>[];
	properties<T>(key: UniqueMetadataKey<T>): DecoratedPropertyUnique<T>[];
	properties<T>(key: ListMetadataKey<T>): DecoratedPropertyList<T>[];
}

function isMethodLike(ctor: Ctor, name: string | symbol, isStatic: boolean): boolean {
	const target = isStatic ? (ctor as object) : (ctor.prototype as object);
	const desc = Object.getOwnPropertyDescriptor(target, name);
	if (!desc) {
		return false;
	}
	return typeof desc.value === "function";
}

export class ReflectorImpl implements Reflector {
	private readonly ctor: AnyConstructor;
	private registered = false;
	private readonly methodLikeCache = new Map<string | symbol, boolean>();

	constructor(target: AnyConstructor) {
		this.ctor = target;
	}

	all<T>(key: UniqueMetadataKey<T>): DecoratedItem<T, "unique">[];
	all<T>(key: ListMetadataKey<T>): DecoratedItem<T, "list">[];
	all<T>(key: MetadataKey<T>): DecoratedItem<T>[] {
		this.ensureRegistered();
		const c = this.collectClass<T>(key);
		const methods = this.collectMethods<T>(key);
		const properties = this.collectProperties<T>(key);
		return c ? [c, ...methods, ...properties] : [...methods, ...properties];
	}

	class<T>(key: UniqueMetadataKey<T>): DecoratedClassUnique<T> | undefined;
	class<T>(key: ListMetadataKey<T>): DecoratedClassList<T> | undefined;
	class<T>(key: MetadataKey<T>): DecoratedClass<T> | undefined {
		this.ensureRegistered();
		return this.collectClass<T>(key);
	}

	methods<T>(key: UniqueMetadataKey<T>): DecoratedMethodUnique<T>[];
	methods<T>(key: ListMetadataKey<T>): DecoratedMethodList<T>[];
	methods<T>(key: MetadataKey<T>): DecoratedMethod<T>[] {
		this.ensureRegistered();
		return this.collectMethods<T>(key);
	}

	properties<T>(key: UniqueMetadataKey<T>): DecoratedPropertyUnique<T>[];
	properties<T>(key: ListMetadataKey<T>): DecoratedPropertyList<T>[];
	properties<T>(key: MetadataKey<T>): DecoratedProperty<T>[] {
		this.ensureRegistered();
		return this.collectProperties<T>(key);
	}

	private collectClass<T>(key: MetadataKey): DecoratedClass<T> | undefined {
		const list = collectClassMeta<T>(this.ctor, key);
		if (list.length === 0) {
			return;
		}
		const cardinality = getKeyCardinality(key);
		if (cardinality === "unique") {
			return {
				kind: "class",
				name: targetDisplayName(this.ctor),
				// Store invariant: unique sites hold at most one value; take [0].
				metadata: list[0] as T,
				target: this.ctor,
			} satisfies DecoratedClassUnique<T>;
		}
		return {
			kind: "class",
			name: targetDisplayName(this.ctor),
			metadata: list,
			target: this.ctor,
		} satisfies DecoratedClassList<T>;
	}

	private collectMethods<T>(key: MetadataKey): DecoratedMethod<T>[] {
		return this.collectMembers<T, DecoratedMethodUnique<T> | DecoratedMethodList<T>>(key, "method", true);
	}

	private collectProperties<T>(key: MetadataKey): DecoratedProperty<T>[] {
		return this.collectMembers<T, DecoratedPropertyUnique<T> | DecoratedPropertyList<T>>(key, "property", false);
	}

	private collectMembers<T, R extends DecoratedMethod<T> | DecoratedProperty<T>>(
		key: MetadataKey,
		kind: "method" | "property",
		wantMethod: boolean
	): R[] {
		const names = collectMemberNames(this.ctor, key);
		const cardinality = getKeyCardinality(key);
		const out: R[] = [];
		for (const name of names) {
			const isStatic = getMemberStatic(this.ctor, name);
			if (this.isMethod(name, isStatic) !== wantMethod) {
				continue;
			}
			const raw = collectMemberMeta<T>(this.ctor, key, name);
			out.push({
				kind,
				name,
				static: isStatic,
				metadata: cardinality === "unique" ? (raw[0] as T) : raw,
			} as unknown as R);
		}
		return out;
	}

	private isMethod(name: string | symbol, isStatic: boolean): boolean {
		const cached = this.methodLikeCache.get(name);
		if (cached !== undefined) {
			return cached;
		}
		const result = isMethodLike(this.ctor, name, isStatic);
		this.methodLikeCache.set(name, result);
		return result;
	}

	private ensureRegistered(): void {
		if (this.registered) {
			return;
		}
		prepare(this.ctor);
		if (!(hasAnyClassMeta(this.ctor) || hasAnyMemberMeta(this.ctor))) {
			throw new UnregisteredClassError(this.ctor);
		}
		this.registered = true;
	}
}

/**
 * Returns a reflector for the class of `target` (instances resolve to their
 * constructor). Call {@link prepare} on the class earlier if the decoration
 * might not yet be registered (e.g. instance-only classes without a class decorator).
 */
export function reflect(target: object): Reflector {
	return new ReflectorImpl(resolveReflectTarget(target));
}
