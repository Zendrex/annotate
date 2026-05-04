import { UnregisteredClassError } from "../errors";
import { getKeyCardinality } from "../metadata/cardinality-registry";
import { collectClassMeta } from "../metadata/class-meta-store";
import { hasAnyMeta } from "../metadata/has-any-meta";
import { snapshotMembers } from "../metadata/member-meta-store";
import { prepare } from "../runtime/prepare";
import { targetDisplayName } from "./class-name";
import { resolveReflectTarget } from "./resolve-instance";
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
 * Read API for a single class. Query keys are minted via {@link mintUniqueKey}
 * or {@link mintListKey}; unminted symbols yield no results at read time
 * (rejection of unminted keys happens at decoration time inside
 * `appendClassMeta` / `appendMemberMeta`).
 *
 * Each query ensures the class is prepared via {@link prepare}; if no metadata
 * is registered afterward, {@link UnregisteredClassError} is thrown.
 *
 * @throws {UnregisteredClassError} When the class has no registered metadata after preparation.
 */
export interface Reflector {
	/**
	 * Returns every decorated item for `key`: the class entry first (if
	 * present), then methods, then properties. Within methods and properties,
	 * order follows {@link snapshotMembers} (subclass-first across the chain).
	 */
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
const reflectorCache = new WeakMap<AnyConstructor, ReflectorImpl>();

/**
 * Concrete {@link Reflector}: lazily prepares the class on first successful
 * query and caches member-shape lookups across reads.
 *
 * @internal
 */
export class ReflectorImpl implements Reflector {
	private readonly ctor: AnyConstructor;
	private registered = false;
	private readonly methodLikeCache = new Map<string | symbol, boolean>();

	constructor(target: AnyConstructor) {
		this.ctor = target;
	}

	all<T, C extends Cardinality = Cardinality>(key: MetadataKey<T, C>): DecoratedItem<T, C>[] {
		this.ensureRegistered();
		const c = this.collectClass<T>(key);
		const methods = this.collectMethods<T>(key);
		const properties = this.collectProperties<T>(key);
		const items = c ? [c, ...methods, ...properties] : [...methods, ...properties];
		return items as DecoratedItem<T, C>[];
	}

	class<T, C extends Cardinality = Cardinality>(key: MetadataKey<T, C>): DecoratedClassFor<T, C> | undefined {
		this.ensureRegistered();
		return this.collectClass<T>(key) as DecoratedClassFor<T, C> | undefined;
	}

	methods<T, C extends Cardinality = Cardinality>(key: MetadataKey<T, C>): DecoratedMethodFor<T, C>[] {
		this.ensureRegistered();
		return this.collectMethods<T>(key) as DecoratedMethodFor<T, C>[];
	}

	properties<T, C extends Cardinality = Cardinality>(key: MetadataKey<T, C>): DecoratedPropertyFor<T, C>[] {
		this.ensureRegistered();
		return this.collectProperties<T>(key) as DecoratedPropertyFor<T, C>[];
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

	private collectMethods<T>(key: MetadataKey<T>): DecoratedMethod<T>[] {
		return this.collectMembers<T, DecoratedMethod<T>>(key, "method", true);
	}

	private collectProperties<T>(key: MetadataKey<T>): DecoratedProperty<T>[] {
		return this.collectMembers<T, DecoratedProperty<T>>(key, "property", false);
	}

	private collectMembers<T, R extends DecoratedMethod<T> | DecoratedProperty<T>>(
		key: MetadataKey<T>,
		kind: "method" | "property",
		wantMethod: boolean
	): R[] {
		const snapshot = snapshotMembers(this.ctor, key);
		const cardinality = getKeyCardinality(key);
		const out: R[] = [];
		for (const [name, entry] of snapshot) {
			if (this.isMethod(name, entry.static) !== wantMethod) {
				continue;
			}
			out.push({
				kind,
				name,
				static: entry.static,
				metadata: cardinality === "unique" ? (entry.values[0] as T) : (entry.values as T[]),
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
		if (!hasAnyMeta(this.ctor)) {
			throw new UnregisteredClassError(this.ctor);
		}
		this.registered = true;
	}
}

/**
 * Returns a {@link Reflector} bound to the resolved class. Accepts a
 * constructor or instance; instances are normalised via
 * {@link resolveReflectTarget}. The reflector is cached per constructor;
 * queries lazily invoke {@link prepare} until registration succeeds.
 *
 * @throws {TypeError} If `target` does not resolve to a usable constructor.
 */
export function reflect(target: object): Reflector {
	const ctor = resolveReflectTarget(target);
	const cached = reflectorCache.get(ctor);
	if (cached) {
		return cached;
	}
	const impl = new ReflectorImpl(ctor);
	reflectorCache.set(ctor, impl);
	return impl;
}
