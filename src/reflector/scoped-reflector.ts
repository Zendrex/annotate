import { ReflectorImpl } from "./reflector";
import type { MetadataKey } from "../metadata/types";
import type { Reflector } from "./reflector";
import type {
	AnyConstructor,
	DecoratedClass,
	DecoratedItem,
	DecoratedMethod,
	DecoratedMethodScalar,
	DecoratedProperty,
	DecoratedPropertyScalar,
	ScopedReflector,
} from "./types";

/**
 * Factory for a {@link ScopedReflector}: binds a `MetadataKey` to a class so metadata reads
 * do not repeat the key on every call. Delegates to {@link ReflectorImpl} under the hood.
 *
 * @typeParam TMeta - Metadata type for the key
 * @param ctor - Class whose decorations are read
 * @param key - Metadata key to query (class, method, and property sites that used this key)
 * @returns A scoped reflector for that class and key
 */
export function createScopedReflector<TMeta>(ctor: AnyConstructor, key: MetadataKey): ScopedReflector<TMeta> {
	return new ScopedReflectorImpl<TMeta>(ctor, key);
}

/**
 * Binds one metadata key to a {@link ReflectorImpl}; *Scalar methods surface only the first stored
 * value per site.
 */
class ScopedReflectorImpl<TMeta> implements ScopedReflector<TMeta> {
	private readonly reflector: Reflector;
	private readonly key: MetadataKey;

	constructor(ctor: AnyConstructor, key: MetadataKey) {
		this.reflector = new ReflectorImpl(ctor);
		this.key = key;
	}

	all(): DecoratedItem<TMeta>[] {
		return this.reflector.all<TMeta>(this.key);
	}

	class(): DecoratedClass<TMeta> | undefined {
		return this.reflector.class<TMeta>(this.key);
	}

	methods(): DecoratedMethod<TMeta>[] {
		return this.reflector.methods<TMeta>(this.key);
	}

	methodsScalar(): DecoratedMethodScalar<TMeta>[] {
		return this.reflector.methods<TMeta>(this.key).map((entry) => ({
			kind: entry.kind,
			name: entry.name,
			static: entry.static,
			metadata: entry.metadata[0] as TMeta,
		}));
	}

	properties(): DecoratedProperty<TMeta>[] {
		return this.reflector.properties<TMeta>(this.key);
	}

	propertiesScalar(): DecoratedPropertyScalar<TMeta>[] {
		return this.reflector.properties<TMeta>(this.key).map((entry) => ({
			kind: entry.kind,
			name: entry.name,
			static: entry.static,
			metadata: entry.metadata[0] as TMeta,
		}));
	}
}
