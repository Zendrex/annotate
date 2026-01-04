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
 * @example
 * const methods = reflect(UserController).methods<RouteMetadata>(ROUTE_KEY);
 * for (const { name, metadata } of methods) {
 *   console.log(name, metadata);
 * }
 */
export class Reflector {
	private readonly ctor: AnyConstructor;
	private readonly proto: object;

	constructor(target: AnyConstructor) {
		this.ctor = target;
		this.proto = target.prototype;
	}

	/**
	 * Get all decorated items for a metadata key.
	 */
	all<T>(key: MetadataKey): DecoratedItem<T>[] {
		return [...this.class<T>(key), ...this.methods<T>(key), ...this.properties<T>(key), ...this.parameters<T>(key)];
	}

	/**
	 * Get class-level metadata.
	 */
	class<T>(key: MetadataKey): DecoratedClass<T>[] {
		const metadata = getMetadataArray<T>(key, this.ctor);
		if (metadata.length === 0) {
			return [];
		}

		return [{ kind: "class", name: "constructor", metadata, target: this.ctor }];
	}

	/**
	 * Get method metadata (instance and static). Walks prototype chain for inheritance.
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
	 * Get property metadata (instance and static). Walks prototype chain for inheritance.
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
	 */
	parameters<T>(key: MetadataKey): DecoratedParameter<T>[] {
		const results: DecoratedParameter<T>[] = [];

		// Constructor parameters
		const ctorMap = getParameterMap<T>(key, this.ctor);
		if (ctorMap instanceof Map) {
			for (const [index, metadata] of ctorMap) {
				if (metadata.length > 0) {
					results.push({
						kind: "parameter",
						name: "constructor",
						metadata,
						parameterIndex: index,
					});
				}
			}
		}

		// Method parameters (instance) - walk prototype chain
		const seenParams = new Set<string | symbol>();
		for (const { target, name } of this.getKeysWithTarget(this.proto)) {
			if (seenParams.has(name)) {
				continue;
			}

			const map = getParameterMap<T>(key, target, name);
			if (!(map instanceof Map)) {
				continue;
			}

			for (const [index, metadata] of map) {
				if (metadata.length > 0) {
					seenParams.add(name);
					results.push({
						kind: "parameter",
						name,
						metadata,
						parameterIndex: index,
					});
				}
			}
		}

		// Method parameters (static)
		for (const name of this.getOwnKeys(this.ctor)) {
			const map = getParameterMap<T>(key, this.ctor, name);
			if (!(map instanceof Map)) {
				continue;
			}
			for (const [index, metadata] of map) {
				if (metadata.length > 0) {
					results.push({
						kind: "parameter",
						name,
						metadata,
						parameterIndex: index,
					});
				}
			}
		}

		return results;
	}

	/**
	 * Get own keys from a single object (no prototype chain).
	 */
	private getOwnKeys(target: object): (string | symbol)[] {
		return [...Object.getOwnPropertyNames(target), ...Object.getOwnPropertySymbols(target)].filter(
			(k) => k !== "constructor" && k !== "prototype",
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
 * Creates a Reflector for the given class constructor.
 *
 * @example
 * const entries = reflect(MyClass).methods<string>(MY_KEY);
 */
export function reflect(target: AnyConstructor): Reflector {
	return new Reflector(target);
}

/**
 * A reflector pre-bound to a specific metadata key.
 * Provides the same API as Reflector but without needing to pass the key to each method.
 *
 * @example
 * const scoped = createScopedReflector(MyClass, ROUTE_KEY);
 * const methods = scoped.methods(); // No key needed
 */
class ScopedReflectorImpl<TMeta> implements ScopedReflector<TMeta> {
	private readonly reflector: Reflector;
	private readonly key: MetadataKey;

	constructor(target: AnyConstructor, key: MetadataKey) {
		this.reflector = new Reflector(target);
		this.key = key;
	}

	/**
	 * Get all decorated items for this key.
	 */
	all(): DecoratedItem<TMeta>[] {
		return this.reflector.all<TMeta>(this.key);
	}

	/**
	 * Get class-level metadata.
	 */
	class(): DecoratedClass<TMeta>[] {
		return this.reflector.class<TMeta>(this.key);
	}

	/**
	 * Get method metadata (instance + static).
	 */
	methods(): DecoratedMethod<TMeta>[] {
		return this.reflector.methods<TMeta>(this.key);
	}

	/**
	 * Get property metadata (instance + static).
	 */
	properties(): DecoratedProperty<TMeta>[] {
		return this.reflector.properties<TMeta>(this.key);
	}

	/**
	 * Get parameter metadata (constructor + methods).
	 */
	parameters(): DecoratedParameter<TMeta>[] {
		return this.reflector.parameters<TMeta>(this.key);
	}
}

/**
 * Creates a ScopedReflector pre-bound to a specific metadata key.
 *
 * @example
 * const Route = createMethodDecorator<string>();
 * const scoped = createScopedReflector(MyClass, Route.key);
 * const methods = scoped.methods();
 */
export function createScopedReflector<TMeta>(target: AnyConstructor, key: MetadataKey): ScopedReflector<TMeta> {
	return new ScopedReflectorImpl<TMeta>(target, key);
}
