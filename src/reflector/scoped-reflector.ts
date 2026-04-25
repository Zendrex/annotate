import { getKeyCardinality } from "../metadata/cardinality-registry";
import { ReflectorImpl } from "./reflector";
import type { ListMetadataKey, MetadataKey, UniqueMetadataKey } from "../metadata/types";
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
export function createScopedReflector<T, C extends "unique" | "list">(
	ctor: AnyConstructor,
	key: MetadataKey<T, C>
): ScopedReflector<T, C> {
	// The impl satisfies the interface at runtime; the cast satisfies the conditional
	// return types in the interface which TS cannot verify through the class.
	return new ScopedReflectorImpl<T, C>(ctor, key) as unknown as ScopedReflector<T, C>;
}

/**
 * Binds one metadata key to a {@link ReflectorImpl}; delegates to the brand-aware
 * overloads on `Reflector` so unique keys surface scalar `metadata` and list keys
 * surface array `metadata`.
 */
class ScopedReflectorImpl<TMeta, TCard extends "unique" | "list" = "unique" | "list"> {
	private readonly reflector: Reflector;
	private readonly key: MetadataKey<TMeta, TCard>;
	private readonly isUnique: boolean;

	constructor(ctor: AnyConstructor, key: MetadataKey<TMeta, TCard>) {
		this.reflector = new ReflectorImpl(ctor);
		this.key = key;
		// The brand is phantom-only; use the cardinality registry for runtime dispatch.
		// Treat unknown cardinality (raw Symbol keys) as "list" — keep full array form.
		this.isUnique = getKeyCardinality(key) === "unique";
	}

	all(): DecoratedItem<TMeta, TCard>[] {
		if (this.isUnique) {
			return this.reflector.all<TMeta>(this.key as UniqueMetadataKey<TMeta>) as DecoratedItem<TMeta, TCard>[];
		}
		return this.reflector.all<TMeta>(this.key as ListMetadataKey<TMeta>) as DecoratedItem<TMeta, TCard>[];
	}

	class(): (TCard extends "unique" ? DecoratedClassUnique<TMeta> : DecoratedClassList<TMeta>) | undefined {
		type ReturnType =
			| (TCard extends "unique" ? DecoratedClassUnique<TMeta> : DecoratedClassList<TMeta>)
			| undefined;
		if (this.isUnique) {
			return this.reflector.class<TMeta>(this.key as UniqueMetadataKey<TMeta>) as ReturnType;
		}
		return this.reflector.class<TMeta>(this.key as ListMetadataKey<TMeta>) as ReturnType;
	}

	methods(): TCard extends "unique" ? DecoratedMethodUnique<TMeta>[] : DecoratedMethodList<TMeta>[] {
		type ReturnType = TCard extends "unique" ? DecoratedMethodUnique<TMeta>[] : DecoratedMethodList<TMeta>[];
		if (this.isUnique) {
			return this.reflector.methods<TMeta>(this.key as UniqueMetadataKey<TMeta>) as ReturnType;
		}
		return this.reflector.methods<TMeta>(this.key as ListMetadataKey<TMeta>) as ReturnType;
	}

	properties(): TCard extends "unique" ? DecoratedPropertyUnique<TMeta>[] : DecoratedPropertyList<TMeta>[] {
		type ReturnType = TCard extends "unique" ? DecoratedPropertyUnique<TMeta>[] : DecoratedPropertyList<TMeta>[];
		if (this.isUnique) {
			return this.reflector.properties<TMeta>(this.key as UniqueMetadataKey<TMeta>) as ReturnType;
		}
		return this.reflector.properties<TMeta>(this.key as ListMetadataKey<TMeta>) as ReturnType;
	}
}
