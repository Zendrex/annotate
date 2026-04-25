import type { MetadataArray } from "../metadata/types";

/**
 * Any class constructor this library treats as a decoration **target**: a `function` with a
 * non-null object `prototype` (ordinary constructor shape).
 */
// biome-ignore lint/complexity/noBannedTypes: needed for constructor type
export type AnyConstructor = Function & { prototype: object };

/**
 * Which syntactic construct carried the metadata: the class itself, a method, or a property/field.
 */
export type DecoratedKind = "class" | "method" | "property";

/**
 * Shared fields for every reflected decoration: kind, member or class **name**, and all
 * metadata values stored for that site (array form).
 */
export interface DecoratedBase<TMeta> {
	kind: DecoratedKind;
	metadata: MetadataArray<TMeta>;
	name: string | symbol;
}

/**
 * Class-level decoration: metadata attached to the constructor, with **name** as the class
 * display name and **target** as the constructor itself.
 */
export type DecoratedClass<TMeta> = DecoratedBase<TMeta> & {
	kind: "class";
	name: string;
	target: AnyConstructor;
};

/**
 * Method-level decoration (instance or static). **static** distinguishes own properties on the
 * constructor vs the prototype.
 */
export type DecoratedMethod<TMeta> = DecoratedBase<TMeta> & {
	kind: "method";
	static: boolean;
};

/**
 * Like {@link DecoratedMethod}, but **metadata** is a single value (the first entry) for call
 * sites that store at most one value per method.
 */
export type DecoratedMethodScalar<TMeta> = Omit<DecoratedMethod<TMeta>, "metadata"> & {
	metadata: TMeta;
};

/**
 * Property- or field-level decoration. **static** has the same meaning as for
 * {@link DecoratedMethod}.
 */
export type DecoratedProperty<TMeta> = DecoratedBase<TMeta> & {
	kind: "property";
	static: boolean;
};

/**
 * Like {@link DecoratedProperty}, but **metadata** is a single value (the first entry) for
 * scalar use cases.
 */
export type DecoratedPropertyScalar<TMeta> = Omit<DecoratedProperty<TMeta>, "metadata"> & {
	metadata: TMeta;
};

/**
 * Any single reflected item: class, method, or property, with full **metadata** arrays.
 */
export type DecoratedItem<TMeta> = DecoratedClass<TMeta> | DecoratedMethod<TMeta> | DecoratedProperty<TMeta>;

/**
 * Read API for one **metadata key** on a fixed class: same queries as the `Reflector` interface, but the
 * key is bound so callers do not pass it on every call. **Scalar** helpers return the first
 * metadata value per site when you only ever store one value.
 *
 * @typeParam TMeta - Metadata type associated with the bound key
 */
export interface ScopedReflector<TMeta> {
	all(): DecoratedItem<TMeta>[];
	class(): DecoratedClass<TMeta> | undefined;
	methods(): DecoratedMethod<TMeta>[];
	methodsScalar(): DecoratedMethodScalar<TMeta>[];
	properties(): DecoratedProperty<TMeta>[];
	propertiesScalar(): DecoratedPropertyScalar<TMeta>[];
}
