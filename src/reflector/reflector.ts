import { UnregisteredClassError } from "../errors";
import { getKeyCardinality } from "../metadata/cardinality";
import { prepare } from "../metadata/pipeline";
import { collectClassMeta, hasAnyMeta, snapshotMembers } from "../metadata/store";
import { resolveReflectTarget, targetDisplayName } from "./target";
import type { Cardinality, Ctor, MetadataKey } from "../metadata/types";
import type {
	AnyConstructor,
	DecoratedClass,
	DecoratedClassFor,
	DecoratedClassList,
	DecoratedClassUnique,
	DecoratedItem,
	DecoratedMethod,
	DecoratedMethodFor,
	DecoratedProperty,
	DecoratedPropertyFor,
} from "./types";

/**
 * Keys must be minted via `mintUniqueKey` or `mintListKey`. Each query runs
 * `prepare` first; `all()` returns class, then methods, then properties
 * (subclass-first member order).
 */
export interface IReflector {
	all<T, C extends Cardinality = Cardinality>(key: MetadataKey<T, C>): DecoratedItem<T, C>[];
	class<T, C extends Cardinality = Cardinality>(key: MetadataKey<T, C>): DecoratedClassFor<T, C> | undefined;
	methods<T, C extends Cardinality = Cardinality>(key: MetadataKey<T, C>): DecoratedMethodFor<T, C>[];
	properties<T, C extends Cardinality = Cardinality>(key: MetadataKey<T, C>): DecoratedPropertyFor<T, C>[];
}

function isMethodLike(ctor: Ctor, name: string | symbol, isStatic: boolean): boolean {
	const target = isStatic ? (ctor as object) : (ctor.prototype as object);
	const desc = Object.getOwnPropertyDescriptor(target, name);
	if (!desc) {
		return false;
	}
	return typeof desc.value === "function";
}

// Per-ctor cache keeps the registration short-circuit and methodLikeCache warm
// across repeated reflect() calls; without it, every call rebuilds both.
const reflectorCache = new WeakMap<AnyConstructor, Reflector>();

export class Reflector implements IReflector {
	private readonly ctor: AnyConstructor;
	private registered = false;
	private readonly staticMethodLikeCache = new Map<string | symbol, boolean>();
	private readonly instanceMethodLikeCache = new Map<string | symbol, boolean>();

	constructor(target: AnyConstructor) {
		this.ctor = target;
	}

	all<T, C extends Cardinality = Cardinality>(key: MetadataKey<T, C>): DecoratedItem<T, C>[] {
		this.ensureRegistered();
		const classItem = this.collectClass<T>(key);
		const { methods, properties } = this.partitionMembers<T>(key);
		const items = classItem ? [classItem, ...methods, ...properties] : [...methods, ...properties];
		return items as DecoratedItem<T, C>[];
	}

	class<T, C extends Cardinality = Cardinality>(key: MetadataKey<T, C>): DecoratedClassFor<T, C> | undefined {
		this.ensureRegistered();
		return this.collectClass<T>(key) as DecoratedClassFor<T, C> | undefined;
	}

	methods<T, C extends Cardinality = Cardinality>(key: MetadataKey<T, C>): DecoratedMethodFor<T, C>[] {
		this.ensureRegistered();
		return this.partitionMembers<T>(key).methods as DecoratedMethodFor<T, C>[];
	}

	properties<T, C extends Cardinality = Cardinality>(key: MetadataKey<T, C>): DecoratedPropertyFor<T, C>[] {
		this.ensureRegistered();
		return this.partitionMembers<T>(key).properties as DecoratedPropertyFor<T, C>[];
	}

	private collectClass<T>(key: MetadataKey<T>): DecoratedClass<T> | undefined {
		const list = collectClassMeta<T>(this.ctor, key);
		if (list.length === 0) {
			return;
		}
		const cardinality = getKeyCardinality(key);
		if (cardinality === "unique") {
			return {
				kind: "class",
				name: targetDisplayName(this.ctor),
				// Store invariant: unique-cardinality sites hold at most one value.
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

	private partitionMembers<T>(key: MetadataKey<T>): {
		methods: DecoratedMethod<T>[];
		properties: DecoratedProperty<T>[];
	} {
		const snapshot = snapshotMembers(this.ctor, key);
		const cardinality = getKeyCardinality(key);
		const methods: DecoratedMethod<T>[] = [];
		const properties: DecoratedProperty<T>[] = [];
		for (const [name, entry] of snapshot) {
			const metadata = cardinality === "unique" ? (entry.values[0] as T) : (entry.values as T[]);
			if (this.isMethod(name, entry.static)) {
				methods.push({ kind: "method", name, static: entry.static, metadata } as DecoratedMethod<T>);
			} else {
				properties.push({ kind: "property", name, static: entry.static, metadata } as DecoratedProperty<T>);
			}
		}
		return { methods, properties };
	}

	private isMethod(name: string | symbol, isStatic: boolean): boolean {
		const cache = isStatic ? this.staticMethodLikeCache : this.instanceMethodLikeCache;
		const cached = cache.get(name);
		if (cached !== undefined) {
			return cached;
		}
		const result = isMethodLike(this.ctor, name, isStatic);
		cache.set(name, result);
		return result;
	}

	private ensureRegistered(): void {
		if (this.registered) {
			return;
		}
		prepare(this.ctor);
		if (!hasAnyMeta(this.ctor)) {
			throw new UnregisteredClassError(this.ctor);
		}
		this.registered = true;
	}
}

/** Cached per constructor; queries run `prepare` until registration succeeds. */
export function reflect(target: object): IReflector {
	const ctor = resolveReflectTarget(target);
	const cached = reflectorCache.get(ctor);
	if (cached) {
		return cached;
	}
	const impl = new Reflector(ctor);
	reflectorCache.set(ctor, impl);
	return impl;
}
