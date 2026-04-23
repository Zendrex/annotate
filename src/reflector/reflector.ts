import { getMetadata, getMetadataArray, getParameterMap } from "../metadata/store";
import { targetDisplayName } from "./class-name";
import { resolveReflectTarget } from "./resolve-instance";
import type { MetadataArray, MetadataKey } from "../metadata/types";
import type {
	AnyConstructor,
	DecoratedClass,
	DecoratedItem,
	DecoratedMethod,
	DecoratedParameter,
	DecoratedProperty,
} from "./types";

/**
 * Reflection over decorator metadata attached to a class. Each query takes a
 * {@link MetadataKey} so a single reflector can answer for multiple factories.
 *
 * Exposed as a type only — construct instances via {@link reflect}. For
 * single-factory usage prefer `factory.reflect(target)`, which returns a
 * {@link ScopedReflector} pre-bound to that factory's key.
 */
export interface Reflector {
	/** Union of class, methods, properties, and parameters in that order. */
	all<T>(key: MetadataKey): DecoratedItem<T>[];
	class<T>(key: MetadataKey): DecoratedClass<T> | undefined;
	/** Includes static and instance methods; inherited instance methods are deduplicated by name. */
	methods<T>(key: MetadataKey): DecoratedMethod<T>[];
	/** Constructor params first, then instance-method params (dedup by method name up the chain), then static-method params. */
	parameters<T>(key: MetadataKey): DecoratedParameter<T>[];
	/** Includes static and instance properties; inherited instance properties are deduplicated by name. */
	properties<T>(key: MetadataKey): DecoratedProperty<T>[];
}

function isMemberMatch(desc: PropertyDescriptor | undefined, wantFunction: boolean): boolean {
	const isFunction = !!desc && typeof desc.value === "function";
	return wantFunction ? isFunction : !isFunction;
}

/** @internal */
export class ReflectorImpl implements Reflector {
	private readonly ctor: AnyConstructor;
	private readonly proto: object;

	constructor(target: AnyConstructor) {
		this.ctor = target;
		this.proto = target.prototype;
	}

	all<T>(key: MetadataKey): DecoratedItem<T>[] {
		const c = this.class<T>(key);
		return [...(c ? [c] : []), ...this.methods<T>(key), ...this.properties<T>(key), ...this.parameters<T>(key)];
	}

	class<T>(key: MetadataKey): DecoratedClass<T> | undefined {
		const metadata = getMetadata<MetadataArray<T>>(key, this.ctor);
		if (!metadata || metadata.length === 0) {
			return;
		}
		return {
			kind: "class",
			name: targetDisplayName(this.ctor),
			metadata,
			target: this.ctor,
		};
	}

	methods<T>(key: MetadataKey): DecoratedMethod<T>[] {
		return this.collectMembers<T, DecoratedMethod<T>>(key, "method", true);
	}

	properties<T>(key: MetadataKey): DecoratedProperty<T>[] {
		return this.collectMembers<T, DecoratedProperty<T>>(key, "property", false);
	}

	parameters<T>(key: MetadataKey): DecoratedParameter<T>[] {
		const results: DecoratedParameter<T>[] = [];
		this.collectParams(key, this.ctor, "constructor", results, true, undefined, false);
		const seen = new Set<string | symbol>();
		for (const { target, name } of this.getKeysWithTarget(this.proto)) {
			if (seen.has(name)) {
				continue;
			}
			if (this.collectParams(key, target, name, results, false, name, false)) {
				seen.add(name);
			}
		}
		for (const name of this.getOwnKeys(this.ctor)) {
			this.collectParams(key, this.ctor, name, results, false, name, true);
		}
		return results;
	}

	private collectMembers<T, R extends DecoratedMethod<T> | DecoratedProperty<T>>(
		key: MetadataKey,
		kind: "method" | "property",
		wantFunction: boolean
	): R[] {
		const results: R[] = [];
		const seen = new Set<string | symbol>();
		for (const { target, name } of this.getKeysWithTarget(this.proto)) {
			if (seen.has(name)) {
				continue;
			}
			const desc = Object.getOwnPropertyDescriptor(target, name);
			if (!isMemberMatch(desc, wantFunction)) {
				continue;
			}
			const metadata = getMetadataArray<T>(key, target, name);
			if (metadata.length > 0) {
				seen.add(name);
				results.push({ kind, name, static: false, metadata } as R);
			}
		}
		for (const name of this.getOwnKeys(this.ctor)) {
			const desc = Object.getOwnPropertyDescriptor(this.ctor, name);
			if (!isMemberMatch(desc, wantFunction)) {
				continue;
			}
			const metadata = getMetadataArray<T>(key, this.ctor, name);
			if (metadata.length > 0) {
				results.push({ kind, name, static: true, metadata } as R);
			}
		}
		return results;
	}

	private collectParams<T>(
		key: MetadataKey,
		target: object,
		name: string | symbol,
		results: DecoratedParameter<T>[],
		isCtor: boolean,
		methodName: string | symbol | undefined,
		isStatic: boolean
	): boolean {
		const map = getParameterMap<T>(key, target, isCtor ? undefined : name);
		if (!(map instanceof Map)) {
			return false;
		}
		let added = false;
		for (const [index, metadata] of map) {
			if (metadata.length > 0) {
				added = true;
				if (isCtor) {
					results.push({ kind: "constructor-parameter", parameterIndex: index, metadata });
				} else {
					results.push({
						kind: "method-parameter",
						methodName: methodName as string | symbol,
						parameterIndex: index,
						static: isStatic,
						metadata,
					});
				}
			}
		}
		return added;
	}

	private getOwnKeys(target: object): (string | symbol)[] {
		return [...Object.getOwnPropertyNames(target), ...Object.getOwnPropertySymbols(target)].filter(
			(k) => k !== "constructor" && k !== "prototype"
		);
	}

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
 * Create a {@link Reflector} for a class or instance.
 *
 * The target is normalized to its constructor: classes pass through, while
 * instances resolve via their `constructor` property. Plain objects, `Object`
 * itself, and arrow functions lack a usable constructor and cause a `TypeError`
 * with a stable `reflect(target):` prefix for matching in tests.
 *
 * @throws {TypeError} When `target` cannot be resolved to a concrete class constructor
 */
export function reflect(target: object): Reflector {
	return new ReflectorImpl(resolveReflectTarget(target));
}
