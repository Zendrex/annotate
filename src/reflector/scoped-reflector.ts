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
 * @typeParam TMeta - Metadata type for the key
 * @typeParam TCard - Cardinality brand inferred from the key
 * @param ctor - Class whose decorations are read
 * @param key - Metadata key to query
 * @returns A scoped reflector for that class and key
 */
export function createScopedReflector<TMeta, TCard extends Cardinality>(
	ctor: AnyConstructor,
	key: MetadataKey<TMeta, TCard>
): ScopedReflector<TMeta, TCard> {
	return new ScopedReflectorImpl<TMeta, TCard>(ctor, key);
}

type Narrow<TCard extends Cardinality, U, L> = TCard extends "unique" ? U : L;

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
		return this.reflector.all<TMeta>(this.uniqueKey) as DecoratedItem<TMeta, TCard>[];
	}

	class(): Narrow<TCard, DecoratedClassUnique<TMeta>, DecoratedClassList<TMeta>> | undefined {
		return this.reflector.class<TMeta>(this.uniqueKey) as
			| Narrow<TCard, DecoratedClassUnique<TMeta>, DecoratedClassList<TMeta>>
			| undefined;
	}

	methods(): Narrow<TCard, DecoratedMethodUnique<TMeta>[], DecoratedMethodList<TMeta>[]> {
		return this.reflector.methods<TMeta>(this.uniqueKey) as Narrow<
			TCard,
			DecoratedMethodUnique<TMeta>[],
			DecoratedMethodList<TMeta>[]
		>;
	}

	properties(): Narrow<TCard, DecoratedPropertyUnique<TMeta>[], DecoratedPropertyList<TMeta>[]> {
		return this.reflector.properties<TMeta>(this.uniqueKey) as Narrow<
			TCard,
			DecoratedPropertyUnique<TMeta>[],
			DecoratedPropertyList<TMeta>[]
		>;
	}

	// Cast once: ReflectorImpl resolves cardinality from the registry at runtime, so the
	// narrow overload signature is irrelevant. Picking `UniqueMetadataKey` is arbitrary —
	// the result is re-narrowed via `Narrow<TCard, …>` at each return.
	private get uniqueKey(): import("../metadata/types").UniqueMetadataKey<TMeta> {
		return this.key as import("../metadata/types").UniqueMetadataKey<TMeta>;
	}
}
