import { ReflectorImpl } from "./reflector";
import type { MetadataKey } from "../metadata/types";
import type { Reflector } from "./reflector";
import type {
	AnyConstructor,
	DecoratedClass,
	DecoratedItem,
	DecoratedMethod,
	DecoratedMethodSingle,
	DecoratedParameter,
	DecoratedProperty,
	DecoratedPropertySingle,
	ScopedReflector,
} from "./types";

/** @internal */
export function createScopedReflector<TMeta>(ctor: AnyConstructor, key: MetadataKey): ScopedReflector<TMeta> {
	return new ScopedReflectorImpl<TMeta>(ctor, key);
}

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

	methodsSingular(): DecoratedMethodSingle<TMeta>[] {
		return this.reflector
			.methods<TMeta>(this.key)
			.map((entry) => ({ ...entry, metadata: entry.metadata[0] as TMeta }));
	}

	properties(): DecoratedProperty<TMeta>[] {
		return this.reflector.properties<TMeta>(this.key);
	}

	propertiesSingular(): DecoratedPropertySingle<TMeta>[] {
		return this.reflector
			.properties<TMeta>(this.key)
			.map((entry) => ({ ...entry, metadata: entry.metadata[0] as TMeta }));
	}

	parameters(): DecoratedParameter<TMeta>[] {
		return this.reflector.parameters<TMeta>(this.key);
	}
}
