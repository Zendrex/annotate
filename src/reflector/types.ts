import type { Cardinality } from "../metadata/types";

/** Function with a non-null object `prototype` — i.e. anything class-shaped. */
// biome-ignore lint/complexity/noBannedTypes: needed for constructor type
export type AnyConstructor = Function & { prototype: object };

export type DecoratedKind = "class" | "method" | "property";

// ── Class ─────────────────────────────────────────────────────────────────────

export interface DecoratedClassUnique<TMeta> {
	kind: "class";
	metadata: TMeta;
	name: string;
	target: AnyConstructor;
}

export interface DecoratedClassList<TMeta> {
	kind: "class";
	metadata: readonly TMeta[];
	name: string;
	target: AnyConstructor;
}

export type DecoratedClass<TMeta> = DecoratedClassUnique<TMeta> | DecoratedClassList<TMeta>;

// ── Method ────────────────────────────────────────────────────────────────────

/**
 * Method-level decoration with a unique-cardinality key.
 *
 * `static` is `true` for own properties on the constructor and `false` for
 * properties on the prototype.
 */
export interface DecoratedMethodUnique<TMeta> {
	kind: "method";
	metadata: TMeta;
	name: string | symbol;
	static: boolean;
}

/** Method-level decoration with a list-cardinality key. `static` as for {@link DecoratedMethodUnique}. */
export interface DecoratedMethodList<TMeta> {
	kind: "method";
	metadata: readonly TMeta[];
	name: string | symbol;
	static: boolean;
}

/** Internal union; branded keys narrow to one method shape on the public API. */
export type DecoratedMethod<TMeta> = DecoratedMethodUnique<TMeta> | DecoratedMethodList<TMeta>;

// ── Property ──────────────────────────────────────────────────────────────────

/** Property/field decoration with a unique-cardinality key. `static` as for {@link DecoratedMethodUnique}. */
export interface DecoratedPropertyUnique<TMeta> {
	kind: "property";
	metadata: TMeta;
	name: string | symbol;
	static: boolean;
}

/**
 * Property/field decoration with a list-cardinality key. `metadata` preserves
 * decoration order. `static` as for {@link DecoratedMethodUnique}.
 */
export interface DecoratedPropertyList<TMeta> {
	kind: "property";
	metadata: readonly TMeta[];
	name: string | symbol;
	static: boolean;
}

/** Internal union; consumers receive a narrowed shape via branded key overloads. */
export type DecoratedProperty<TMeta> = DecoratedPropertyUnique<TMeta> | DecoratedPropertyList<TMeta>;

// ── DecoratedItem ─────────────────────────────────────────────────────────────

/** Selects class-decoration shape from a cardinality brand. */
export type DecoratedClassFor<TMeta, TCard extends Cardinality> = TCard extends "unique"
	? DecoratedClassUnique<TMeta>
	: DecoratedClassList<TMeta>;

/** Selects method-decoration shape from a cardinality brand. */
export type DecoratedMethodFor<TMeta, TCard extends Cardinality> = TCard extends "unique"
	? DecoratedMethodUnique<TMeta>
	: DecoratedMethodList<TMeta>;

/** Selects property-decoration shape from a cardinality brand. */
export type DecoratedPropertyFor<TMeta, TCard extends Cardinality> = TCard extends "unique"
	? DecoratedPropertyUnique<TMeta>
	: DecoratedPropertyList<TMeta>;

/**
 * Any reflected item, specialised on cardinality:
 *
 * - `DecoratedItem<T, "unique">` — `metadata` is a scalar `T`.
 * - `DecoratedItem<T, "list">` — `metadata` is `readonly T[]`.
 * - `DecoratedItem<T>` — union of both.
 */
export type DecoratedItem<TMeta, TCard extends Cardinality = Cardinality> =
	| DecoratedClassFor<TMeta, TCard>
	| DecoratedMethodFor<TMeta, TCard>
	| DecoratedPropertyFor<TMeta, TCard>;

// ── ScopedReflector ───────────────────────────────────────────────────────────

/**
 * Read API for a single key bound to a fixed class. Same queries as
 * {@link Reflector}, with the key elided. `TCard` narrows `metadata` to scalar
 * (`"unique"`) or array (`"list"`) form.
 */
export interface ScopedReflector<TMeta, TCard extends Cardinality = Cardinality> {
	all(): DecoratedItem<TMeta, TCard>[];
	class(): DecoratedClassFor<TMeta, TCard> | undefined;
	methods(): DecoratedMethodFor<TMeta, TCard>[];
	properties(): DecoratedPropertyFor<TMeta, TCard>[];
}
