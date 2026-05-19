import { ReflectorImpl } from "./reflector";
import type { Cardinality, MetadataKey, UniqueMetadataKey } from "../metadata/types";
import type { Reflector } from "./reflector";
import type {
	AnyConstructor,
	DecoratedClassFor,
	DecoratedItem,
	DecoratedMethodFor,
	DecoratedPropertyFor,
	ScopedReflector,
} from "./types";

export function createScopedReflector<TMeta, TCard extends Cardinality>(
	ctor: AnyConstructor,
	key: MetadataKey<TMeta, TCard>
): ScopedReflector<TMeta, TCard> {
	return new ScopedReflectorImpl<TMeta, TCard>(ctor, key);
}

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

	class(): DecoratedClassFor<TMeta, TCard> | undefined {
		return this.reflector.class<TMeta>(this.uniqueKey) as DecoratedClassFor<TMeta, TCard> | undefined;
	}

	methods(): DecoratedMethodFor<TMeta, TCard>[] {
		return this.reflector.methods<TMeta>(this.uniqueKey) as DecoratedMethodFor<TMeta, TCard>[];
	}

	properties(): DecoratedPropertyFor<TMeta, TCard>[] {
		return this.reflector.properties<TMeta>(this.uniqueKey) as DecoratedPropertyFor<TMeta, TCard>[];
	}

	// ReflectorImpl resolves cardinality from the registry at runtime; the static
	// overload picked here is arbitrary and re-narrowed via `DecoratedXFor` at returns.
	private get uniqueKey(): UniqueMetadataKey<TMeta> {
		return this.key as UniqueMetadataKey<TMeta>;
	}
}
