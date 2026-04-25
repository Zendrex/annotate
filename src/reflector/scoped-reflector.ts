import { ReflectorImpl } from "./reflector";
import type { Cardinality, MetadataKey } from "../metadata/types";
import type { Reflector } from "./reflector";
import type {
	AnyConstructor,
	DecoratedClassList,
	DecoratedClassUnique,
	DecoratedItem,
	DecoratedMethodList,
	DecoratedMethodUnique,
	DecoratedPropertyList,
	DecoratedPropertyUnique,
	ScopedReflector,
} from "./types";

/**
 * Factory for a {@link ScopedReflector}: binds a `MetadataKey` to a class so metadata reads
 * do not repeat the key on every call. The cardinality brand on the key narrows the returned
 * reflector's `metadata` shapes to scalar (`"unique"`) or array (`"list"`).
 *
 * @typeParam T - Metadata type for the key
 * @typeParam C - Cardinality brand inferred from the key
 * @param ctor - Class whose decorations are read
 * @param key - Metadata key to query
 * @returns A scoped reflector for that class and key
 */
export function createScopedReflector<T, C extends Cardinality>(
	ctor: AnyConstructor,
	key: MetadataKey<T, C>
): ScopedReflector<T, C> {
	return new ScopedReflectorImpl<T, C>(ctor, key);
}

/**
 * Binds one metadata key to a {@link ReflectorImpl}. The underlying reflector resolves
 * cardinality from the registry at runtime, so this class only carries types.
 */
class ScopedReflectorImpl<TMeta, TCard extends Cardinality = Cardinality> implements ScopedReflector<TMeta, TCard> {
	private readonly reflector: Reflector;
	private readonly key: MetadataKey<TMeta, TCard>;

	constructor(ctor: AnyConstructor, key: MetadataKey<TMeta, TCard>) {
		this.reflector = new ReflectorImpl(ctor);
		this.key = key;
	}

	all(): DecoratedItem<TMeta, TCard>[] {
		return this.reflector.all<TMeta>(this.key) as DecoratedItem<TMeta, TCard>[];
	}

	class(): (TCard extends "unique" ? DecoratedClassUnique<TMeta> : DecoratedClassList<TMeta>) | undefined {
		return this.reflector.class<TMeta>(this.key) as
			| (TCard extends "unique" ? DecoratedClassUnique<TMeta> : DecoratedClassList<TMeta>)
			| undefined;
	}

	methods(): TCard extends "unique" ? DecoratedMethodUnique<TMeta>[] : DecoratedMethodList<TMeta>[] {
		return this.reflector.methods<TMeta>(this.key) as TCard extends "unique"
			? DecoratedMethodUnique<TMeta>[]
			: DecoratedMethodList<TMeta>[];
	}

	properties(): TCard extends "unique" ? DecoratedPropertyUnique<TMeta>[] : DecoratedPropertyList<TMeta>[] {
		return this.reflector.properties<TMeta>(this.key) as TCard extends "unique"
			? DecoratedPropertyUnique<TMeta>[]
			: DecoratedPropertyList<TMeta>[];
	}
}
