import type { MetadataArray } from "../metadata/types";

/**
 * Permissive constructor shape accepted by reflection entry points.
 *
 * Typed as `Function & { prototype: object }` to also admit abstract classes
 * and classes with non-public constructors. Runtime validation in
 * `resolveReflectTarget` rejects plain functions that lack an object prototype.
 */
// biome-ignore lint/complexity/noBannedTypes: needed for constructor type
export type AnyConstructor = Function & { prototype: object };

/** Discriminator for the kind of decorated item in {@link DecoratedItem}. */
export type DecoratedKind = "class" | "method" | "property" | "constructor-parameter" | "method-parameter";

/**
 * Common shape shared by class / method / property reflection results.
 *
 * `metadata` preserves declaration order (bottom-up, matching TypeScript's
 * decorator evaluation). Parameters omit `name` because they are identified by
 * slot rather than identifier.
 */
export interface DecoratedBase<TMeta> {
	kind: DecoratedKind;
	metadata: MetadataArray<TMeta>;
	name: string | symbol;
}

/**
 * Reflection result for a decorated class.
 *
 * `name` is derived from the constructor, with a stable fallback when the
 * class is anonymous. `target` is always a resolved constructor, not an
 * instance or prototype.
 */
export type DecoratedClass<TMeta> = DecoratedBase<TMeta> & {
	kind: "class";
	name: string;
	target: AnyConstructor;
};

/**
 * Reflection result for a decorated method. `static` is `true` when the
 * method is declared on the constructor rather than the prototype.
 */
export type DecoratedMethod<TMeta> = DecoratedBase<TMeta> & {
	kind: "method";
	static: boolean;
};

/**
 * Flattened {@link DecoratedMethod} exposing the first metadata entry as a
 * scalar. Suitable for factories whose `unique` option guarantees at most one
 * application; with non-unique decorators only the first value is surfaced.
 */
export type DecoratedMethodSingle<TMeta> = Omit<DecoratedMethod<TMeta>, "metadata"> & {
	metadata: TMeta;
};

/** Reflection result for a decorated property. `static` mirrors {@link DecoratedMethod}. */
export type DecoratedProperty<TMeta> = DecoratedBase<TMeta> & {
	kind: "property";
	static: boolean;
};

/** Flattened {@link DecoratedProperty}; see {@link DecoratedMethodSingle} for semantics. */
export type DecoratedPropertySingle<TMeta> = Omit<DecoratedProperty<TMeta>, "metadata"> & {
	metadata: TMeta;
};

/** Reflection result for a decorated constructor parameter, keyed by slot. */
export type DecoratedConstructorParameter<TMeta> = Omit<DecoratedBase<TMeta>, "name"> & {
	kind: "constructor-parameter";
	parameterIndex: number;
};

/**
 * Reflection result for a decorated method parameter. `methodName` identifies
 * the owning method; `static` is `true` when the method lives on the constructor.
 */
export type DecoratedMethodParameter<TMeta> = Omit<DecoratedBase<TMeta>, "name"> & {
	kind: "method-parameter";
	methodName: string | symbol;
	parameterIndex: number;
	static: boolean;
};

export type DecoratedParameter<TMeta> = DecoratedConstructorParameter<TMeta> | DecoratedMethodParameter<TMeta>;

/** Union of every reflection result shape. Narrow by the `kind` discriminator. */
export type DecoratedItem<TMeta> =
	| DecoratedClass<TMeta>
	| DecoratedMethod<TMeta>
	| DecoratedProperty<TMeta>
	| DecoratedParameter<TMeta>;

/**
 * Reflector pre-bound to a specific metadata key and target class. Returned by
 * `factory.reflect(target)` and the underlying factory helpers.
 *
 * `methodsSingular` / `propertiesSingular` return the first metadata value per
 * member and are intended for `unique: true` factories; use `methods` /
 * `properties` when multiple applications are expected.
 */
export interface ScopedReflector<TMeta> {
	all(): DecoratedItem<TMeta>[];
	class(): DecoratedClass<TMeta> | undefined;
	methods(): DecoratedMethod<TMeta>[];
	methodsSingular(): DecoratedMethodSingle<TMeta>[];
	parameters(): DecoratedParameter<TMeta>[];
	properties(): DecoratedProperty<TMeta>[];
	propertiesSingular(): DecoratedPropertySingle<TMeta>[];
}
