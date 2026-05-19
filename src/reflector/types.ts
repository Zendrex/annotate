import type { Cardinality } from "../metadata/types";

// biome-ignore lint/complexity/noBannedTypes: needed for constructor type
export type AnyConstructor = Function & { prototype: object };

export type DecoratedKind = "class" | "method" | "property" | "field" | "accessor";

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

export interface DecoratedMethodUnique<TMeta> {
	kind: "method";
	metadata: TMeta;
	name: string | symbol;
	static: boolean;
}

export interface DecoratedMethodList<TMeta> {
	kind: "method";
	metadata: readonly TMeta[];
	name: string | symbol;
	static: boolean;
}

export type DecoratedMethod<TMeta> = DecoratedMethodUnique<TMeta> | DecoratedMethodList<TMeta>;

export interface DecoratedPropertyUnique<TMeta> {
	kind: "property";
	metadata: TMeta;
	name: string | symbol;
	static: boolean;
}

export interface DecoratedPropertyList<TMeta> {
	kind: "property";
	metadata: readonly TMeta[];
	name: string | symbol;
	static: boolean;
}

export type DecoratedProperty<TMeta> = DecoratedPropertyUnique<TMeta> | DecoratedPropertyList<TMeta>;

export type DecoratedClassFor<TMeta, TCard extends Cardinality> = TCard extends "unique"
	? DecoratedClassUnique<TMeta>
	: DecoratedClassList<TMeta>;

export type DecoratedMethodFor<TMeta, TCard extends Cardinality> = TCard extends "unique"
	? DecoratedMethodUnique<TMeta>
	: DecoratedMethodList<TMeta>;

export type DecoratedPropertyFor<TMeta, TCard extends Cardinality> = TCard extends "unique"
	? DecoratedPropertyUnique<TMeta>
	: DecoratedPropertyList<TMeta>;

export type DecoratedItem<TMeta, TCard extends Cardinality = Cardinality> =
	| DecoratedClassFor<TMeta, TCard>
	| DecoratedMethodFor<TMeta, TCard>
	| DecoratedPropertyFor<TMeta, TCard>;

/** Reflector queries with the key elided. */
export interface IScopedReflector<TMeta, TCard extends Cardinality = Cardinality> {
	all(): DecoratedItem<TMeta, TCard>[];
	class(): DecoratedClassFor<TMeta, TCard> | undefined;
	methods(): DecoratedMethodFor<TMeta, TCard>[];
	properties(): DecoratedPropertyFor<TMeta, TCard>[];
}
