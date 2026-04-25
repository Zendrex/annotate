import type { Cardinality } from "../metadata/types";

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

// ── Class ─────────────────────────────────────────────────────────────────────

/**
 * Class-level decoration where metadata is a single value (unique-cardinality key).
 */
export interface DecoratedClassUnique<TMeta> {
	kind: "class";
	metadata: TMeta;
	name: string;
	target: AnyConstructor;
}

/**
 * Class-level decoration where metadata is an ordered list (list-cardinality key).
 */
export interface DecoratedClassList<TMeta> {
	kind: "class";
	metadata: readonly TMeta[];
	name: string;
	target: AnyConstructor;
}

/**
 * Class-level decoration: union of unique and list flavors.
 * Use for backwards-compatible call sites that do not narrow on cardinality.
 */
export type DecoratedClass<TMeta> = DecoratedClassUnique<TMeta> | DecoratedClassList<TMeta>;

// ── Method ────────────────────────────────────────────────────────────────────

/**
 * Method-level decoration where metadata is a single value (unique-cardinality key).
 * **static** distinguishes own properties on the constructor vs the prototype.
 */
export interface DecoratedMethodUnique<TMeta> {
	kind: "method";
	metadata: TMeta;
	name: string | symbol;
	static: boolean;
}

/**
 * Method-level decoration where metadata is an ordered list (list-cardinality key).
 * **static** has the same meaning as for {@link DecoratedMethodUnique}.
 */
export interface DecoratedMethodList<TMeta> {
	kind: "method";
	metadata: readonly TMeta[];
	name: string | symbol;
	static: boolean;
}

/**
 * Method-level decoration: union of unique and list flavors.
 * Use for backwards-compatible call sites that do not narrow on cardinality.
 */
export type DecoratedMethod<TMeta> = DecoratedMethodUnique<TMeta> | DecoratedMethodList<TMeta>;

// ── Property ──────────────────────────────────────────────────────────────────

/**
 * Property- or field-level decoration where metadata is a single value (unique-cardinality key).
 * **static** has the same meaning as for {@link DecoratedMethodUnique}.
 */
export interface DecoratedPropertyUnique<TMeta> {
	kind: "property";
	metadata: TMeta;
	name: string | symbol;
	static: boolean;
}

/**
 * Property- or field-level decoration where metadata is an ordered list (list-cardinality key).
 * **static** has the same meaning as for {@link DecoratedMethodUnique}.
 */
export interface DecoratedPropertyList<TMeta> {
	kind: "property";
	metadata: readonly TMeta[];
	name: string | symbol;
	static: boolean;
}

/**
 * Property- or field-level decoration: union of unique and list flavors.
 * Use for backwards-compatible call sites that do not narrow on cardinality.
 */
export type DecoratedProperty<TMeta> = DecoratedPropertyUnique<TMeta> | DecoratedPropertyList<TMeta>;

// ── DecoratedItem ─────────────────────────────────────────────────────────────

/**
 * Any single reflected item, specialised on cardinality.
 *
 * - `DecoratedItem<T, "unique">` — every `metadata` field is a scalar `T`.
 * - `DecoratedItem<T, "list">` — every `metadata` field is `readonly T[]`.
 * - `DecoratedItem<T>` (no second param) — union of both (backwards-compatible).
 */
export type DecoratedItem<TMeta, TCard extends Cardinality = Cardinality> = TCard extends "unique"
	? DecoratedClassUnique<TMeta> | DecoratedMethodUnique<TMeta> | DecoratedPropertyUnique<TMeta>
	: TCard extends "list"
		? DecoratedClassList<TMeta> | DecoratedMethodList<TMeta> | DecoratedPropertyList<TMeta>
		: DecoratedClass<TMeta> | DecoratedMethod<TMeta> | DecoratedProperty<TMeta>;

// ── ScopedReflector ───────────────────────────────────────────────────────────

/**
 * Read API for one **metadata key** on a fixed class: same queries as the `Reflector` interface,
 * but the key is bound so callers do not pass it on every call. The second type parameter `TCard`
 * narrows `metadata` shapes to scalar (`"unique"`) or array (`"list"`).
 *
 * @typeParam TMeta - Metadata type associated with the bound key
 * @typeParam TCard - Cardinality brand: `"unique"` or `"list"`
 */
export interface ScopedReflector<TMeta, TCard extends Cardinality = Cardinality> {
	all(): DecoratedItem<TMeta, TCard>[];
	class(): TCard extends "unique" ? DecoratedClassUnique<TMeta> | undefined : DecoratedClassList<TMeta> | undefined;
	methods(): TCard extends "unique" ? DecoratedMethodUnique<TMeta>[] : DecoratedMethodList<TMeta>[];
	properties(): TCard extends "unique" ? DecoratedPropertyUnique<TMeta>[] : DecoratedPropertyList<TMeta>[];
}
