import { Reflector } from "./reflector";
import type { Cardinality, MetadataKey, UniqueMetadataKey } from "../metadata/types";
import type { IReflector } from "./reflector";
import type {
	AnyConstructor,
	DecoratedClassFor,
	DecoratedItem,
	DecoratedMethodFor,
	DecoratedPropertyFor,
	IScopedReflector,
} from "./types";

/**
 * Returns a reflector bound to one `(ctor, key)` pair, shaping results to the
 * key's runtime cardinality. Equivalent to `reflect(ctor)` queries with the
 * key elided.
 */
export function createScopedReflector<TMeta, TCard extends Cardinality>(
	ctor: AnyConstructor,
	key: MetadataKey<TMeta, TCard>
): IScopedReflector<TMeta, TCard> {
	return new ScopedReflector<TMeta, TCard>(ctor, key);
}

class ScopedReflector<TMeta, TCard extends Cardinality = Cardinality> implements IScopedReflector<TMeta, TCard> {
	private readonly reflector: IReflector;
	private readonly key: MetadataKey<TMeta, TCard>;

	constructor(ctor: AnyConstructor, key: MetadataKey<TMeta, TCard>) {
		this.reflector = new Reflector(ctor);
		this.key = key;
	}

	all(): DecoratedItem<TMeta, TCard>[] {
		return this.reflector.all<TMeta>(this.uniqueKey) as DecoratedItem<TMeta, TCard>[];
	}

	class(): DecoratedClassFor<TMeta, TCard> | undefined {
		return this.reflector.class<TMeta>(this.uniqueKey) as DecoratedClassFor<TMeta, TCard> | undefined;
	}

	methods(): DecoratedMethodFor<TMeta, TCard>[] {
		return this.reflector.methods<TMeta>(this.uniqueKey) as DecoratedMethodFor<TMeta, TCard>[];
	}

	properties(): DecoratedPropertyFor<TMeta, TCard>[] {
		return this.reflector.properties<TMeta>(this.uniqueKey) as DecoratedPropertyFor<TMeta, TCard>[];
	}

	// Reflector resolves cardinality from the registry at runtime; the static
	// overload picked here is arbitrary and re-narrowed via `DecoratedXFor` at returns.
	private get uniqueKey(): UniqueMetadataKey<TMeta> {
		return this.key as UniqueMetadataKey<TMeta>;
	}
}
