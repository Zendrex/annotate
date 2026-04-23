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
 * Reflection over decorator metadata attached to a class. Public as a type only;
 * obtain instances via {@link reflect}.
 */
export interface Reflector {
	all<T>(key: MetadataKey): DecoratedItem<T>[];
	class<T>(key: MetadataKey): DecoratedClass<T> | undefined;
	methods<T>(key: MetadataKey): DecoratedMethod<T>[];
	parameters<T>(key: MetadataKey): DecoratedParameter<T>[];
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
			return undefined;
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
 * Reflect metadata for a class or instance (resolved to its constructor per {@link resolveReflectTarget}).
 */
export function reflect(target: object): Reflector {
	return new ReflectorImpl(resolveReflectTarget(target));
}
