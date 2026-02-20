import type {
	AnyConstructor,
	DecoratedClass,
	DecoratedItem,
	DecoratedMethod,
	DecoratedParameter,
	DecoratedProperty,
	MetadataKey,
	ScopedReflector,
} from "./types";

import { getMetadataArray, getParameterMap } from "./metadata";

/**
 * Provides reflection over decorator metadata attached to a class.
 *
 * The Reflector traverses a class and its prototype chain to collect
 * metadata from all decorated items: the class itself, methods, properties,
 * and parameters (both constructor and method parameters).
 *
 * For a simpler API when working with a single decorator, use
 * {@link createScopedReflector} to get a reflector pre-bound to a metadata key.
 *
 * @example
 * ```typescript
 * const ROUTE_KEY = Symbol("route");
 * const methods = reflect(UserController).methods<RouteMetadata>(ROUTE_KEY);
 * for (const { name, metadata } of methods) {
 *   console.log(name, metadata);
 * }
 * ```
 */
export class Reflector {
	/** The class constructor being reflected. */
	private readonly ctor: AnyConstructor;
	/** The prototype of the class for instance member lookups. */
	private readonly proto: object;

	/**
	 * Creates a new Reflector for the given class constructor.
	 *
	 * @param target - The class constructor to reflect metadata from
	 */
	constructor(target: AnyConstructor) {
		this.ctor = target;
		this.proto = target.prototype;
	}

	/**
	 * Get all decorated items for a metadata key.
	 *
	 * Collects metadata from the class, all methods, all properties, and all
	 * parameters (constructor and method) in a single array.
	 *
	 * @typeParam T - The type of metadata stored by the decorator
	 * @param key - The unique {@link MetadataKey} for the decorator
	 * @returns Array of all {@link DecoratedItem} entries across all decoration targets
	 */
	all<T>(key: MetadataKey): DecoratedItem<T>[] {
		return [...this.class<T>(key), ...this.methods<T>(key), ...this.properties<T>(key), ...this.parameters<T>(key)];
	}

	/**
	 * Get class-level metadata.
	 *
	 * Returns an array containing a single {@link DecoratedClass} entry if the
	 * class has metadata for the given key, or an empty array otherwise.
	 *
	 * @typeParam T - The type of metadata stored by the decorator
	 * @param key - The unique {@link MetadataKey} for the decorator
	 * @returns Array of {@link DecoratedClass} entries (at most one per class)
	 */
	class<T>(key: MetadataKey): DecoratedClass<T>[] {
		const metadata = getMetadataArray<T>(key, this.ctor);
		if (metadata.length === 0) {
			return [];
		}

		return [{ kind: "class", name: "constructor", metadata, target: this.ctor }];
	}

	/**
	 * Get method metadata (instance and static).
	 *
	 * Walks the prototype chain to include inherited instance methods,
	 * then collects static methods from the constructor. If an instance
	 * method is overridden in a subclass, only the most derived metadata
	 * is returned.
	 *
	 * @typeParam T - The type of metadata stored by the decorator
	 * @param key - The unique {@link MetadataKey} for the decorator
	 * @returns Array of {@link DecoratedMethod} entries for instance and static methods
	 */
	methods<T>(key: MetadataKey): DecoratedMethod<T>[] {
		const results: DecoratedMethod<T>[] = [];
		const seen = new Set<string | symbol>();

		// Instance methods - walk prototype chain
		for (const { target, name } of this.getKeysWithTarget(this.proto)) {
			if (seen.has(name)) {
				continue;
			}

			const desc = Object.getOwnPropertyDescriptor(target, name);
			if (!desc || typeof desc.value !== "function") {
				continue;
			}

			const metadata = getMetadataArray<T>(key, target, name);
			if (metadata.length > 0) {
				seen.add(name);
				results.push({ kind: "method", name, metadata, target: desc.value });
			}
		}

		// Static methods
		for (const name of this.getOwnKeys(this.ctor)) {
			const desc = Object.getOwnPropertyDescriptor(this.ctor, name);
			if (!desc || typeof desc.value !== "function") {
				continue;
			}

			const metadata = getMetadataArray<T>(key, this.ctor, name);
			if (metadata.length > 0) {
				results.push({ kind: "method", name, metadata, target: desc.value });
			}
		}

		return results;
	}

	/**
	 * Get property metadata (instance and static).
	 *
	 * Walks the prototype chain to include inherited instance properties,
	 * then collects static properties from the constructor. Properties
	 * with function values are excluded (those are methods).
	 *
	 * @typeParam T - The type of metadata stored by the decorator
	 * @param key - The unique {@link MetadataKey} for the decorator
	 * @returns Array of {@link DecoratedProperty} entries for instance and static properties
	 */
	properties<T>(key: MetadataKey): DecoratedProperty<T>[] {
		const results: DecoratedProperty<T>[] = [];
		const seen = new Set<string | symbol>();

		// Instance properties - walk prototype chain
		for (const { target, name } of this.getKeysWithTarget(this.proto)) {
			if (seen.has(name)) {
				continue;
			}

			const desc = Object.getOwnPropertyDescriptor(target, name);
			if (desc && typeof desc.value === "function") {
				continue;
			}

			const metadata = getMetadataArray<T>(key, target, name);
			if (metadata.length > 0) {
				seen.add(name);
				results.push({ kind: "property", name, metadata });
			}
		}

		// Static properties
		for (const name of this.getOwnKeys(this.ctor)) {
			const desc = Object.getOwnPropertyDescriptor(this.ctor, name);
			if (desc && typeof desc.value === "function") {
				continue;
			}

			const metadata = getMetadataArray<T>(key, this.ctor, name);
			if (metadata.length > 0) {
				results.push({ kind: "property", name, metadata });
			}
		}

		return results;
	}

	/**
	 * Get parameter metadata (constructor and method parameters).
	 *
	 * Collects decorated parameters from the constructor and all methods
	 * (instance and static). Walks the prototype chain for inherited
	 * method parameters.
	 *
	 * @typeParam T - The type of metadata stored by the decorator
	 * @param key - The unique {@link MetadataKey} for the decorator
	 * @returns Array of {@link DecoratedParameter} entries with their parameter indexes
	 */
	parameters<T>(key: MetadataKey): DecoratedParameter<T>[] {
		const results: DecoratedParameter<T>[] = [];

		// Constructor parameters
		this.collectParams(key, this.ctor, "constructor", results);

		// Method parameters (instance) - walk prototype chain
		const seenParams = new Set<string | symbol>();
		for (const { target, name } of this.getKeysWithTarget(this.proto)) {
			if (seenParams.has(name)) {
				continue;
			}
			if (this.collectParams(key, target, name, results)) {
				seenParams.add(name);
			}
		}

		// Method parameters (static)
		for (const name of this.getOwnKeys(this.ctor)) {
			this.collectParams(key, this.ctor, name, results);
		}

		return results;
	}

	/**
	 * Collect parameter metadata from a target into results.
	 * @returns true if any entries were added
	 */
	private collectParams<T>(
		key: MetadataKey,
		target: object,
		name: string | symbol,
		results: DecoratedParameter<T>[]
	): boolean {
		const map = getParameterMap<T>(key, target, name === "constructor" ? undefined : name);
		if (!(map instanceof Map)) {
			return false;
		}
		let added = false;
		for (const [index, metadata] of map) {
			if (metadata.length > 0) {
				added = true;
				results.push({ kind: "parameter", name, metadata, parameterIndex: index });
			}
		}
		return added;
	}

	/**
	 * Get own keys from a single object (no prototype chain).
	 */
	private getOwnKeys(target: object): (string | symbol)[] {
		return [...Object.getOwnPropertyNames(target), ...Object.getOwnPropertySymbols(target)].filter(
			(k) => k !== "constructor" && k !== "prototype"
		);
	}

	/**
	 * Walk the prototype chain and yield keys with their defining target.
	 * This allows us to check metadata at the correct prototype level.
	 */
	private *getKeysWithTarget(target: object): Generator<{ target: object; name: string | symbol }> {
		let current: object | null = target;

		while (current !== null && current !== Object.prototype) {
			for (const name of this.getOwnKeys(current)) {
				yield { target: current, name };
			}
			current = Object.getPrototypeOf(current);
		}
	}
}

/**
 * Creates a {@link Reflector} for the given class constructor.
 *
 * Primary entry point for reflecting on decorator metadata.
 *
 * @param target - The class constructor to reflect metadata from
 * @returns A new {@link Reflector} instance bound to the target
 *
 * @example
 * ```typescript
 * const entries = reflect(MyClass).methods<string>(MY_KEY);
 * ```
 */
export function reflect(target: AnyConstructor): Reflector {
	return new Reflector(target);
}

/**
 * A reflector pre-bound to a specific metadata key.
 *
 * Provides the same API as {@link Reflector} but without needing to pass
 * the key to each method. This is the implementation of {@link ScopedReflector}.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 *
 * @example
 * ```typescript
 * const scoped = createScopedReflector(MyClass, ROUTE_KEY);
 * const methods = scoped.methods(); // No key needed
 * ```
 */
class ScopedReflectorImpl<TMeta> implements ScopedReflector<TMeta> {
	/** The underlying Reflector instance. */
	private readonly reflector: Reflector;
	/** The pre-bound metadata key for all queries. */
	private readonly key: MetadataKey;

	/**
	 * Creates a new ScopedReflectorImpl.
	 *
	 * @param target - The class constructor to reflect metadata from
	 * @param key - The unique {@link MetadataKey} to bind this reflector to
	 */
	constructor(target: AnyConstructor, key: MetadataKey) {
		this.reflector = new Reflector(target);
		this.key = key;
	}

	/**
	 * Get all decorated items for this key.
	 *
	 * @returns Array of all {@link DecoratedItem} entries (class, methods, properties, parameters)
	 */
	all(): DecoratedItem<TMeta>[] {
		return this.reflector.all<TMeta>(this.key);
	}

	/**
	 * Get class-level metadata.
	 *
	 * @returns Array of {@link DecoratedClass} entries (at most one per class)
	 */
	class(): DecoratedClass<TMeta>[] {
		return this.reflector.class<TMeta>(this.key);
	}

	/**
	 * Get method metadata (instance + static).
	 *
	 * @returns Array of {@link DecoratedMethod} entries
	 */
	methods(): DecoratedMethod<TMeta>[] {
		return this.reflector.methods<TMeta>(this.key);
	}

	/**
	 * Get property metadata (instance + static).
	 *
	 * @returns Array of {@link DecoratedProperty} entries
	 */
	properties(): DecoratedProperty<TMeta>[] {
		return this.reflector.properties<TMeta>(this.key);
	}

	/**
	 * Get parameter metadata (constructor + methods).
	 *
	 * @returns Array of {@link DecoratedParameter} entries
	 */
	parameters(): DecoratedParameter<TMeta>[] {
		return this.reflector.parameters<TMeta>(this.key);
	}
}

/**
 * Creates a {@link ScopedReflector} pre-bound to a specific metadata key.
 *
 * Use this when you need to query metadata for a single decorator key
 * multiple times. The returned reflector provides the same API as
 * {@link Reflector} but without requiring the key parameter on each call.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @param target - The class constructor to reflect metadata from
 * @param key - The unique {@link MetadataKey} to bind this reflector to
 * @returns A {@link ScopedReflector} instance pre-bound to the target and key
 *
 * @example
 * ```typescript
 * const Route = createMethodDecorator<string>();
 * const scoped = createScopedReflector(MyClass, Route.key);
 * const methods = scoped.methods(); // No key parameter needed
 * ```
 */
export function createScopedReflector<TMeta>(target: AnyConstructor, key: MetadataKey): ScopedReflector<TMeta> {
	return new ScopedReflectorImpl<TMeta>(target, key);
}
