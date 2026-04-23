import type { MetadataArray } from "../metadata/types";

/** Permissive constructor type accepting any function with prototype, including abstract classes. */
// biome-ignore lint/complexity/noBannedTypes: needed for constructor type
export type AnyConstructor = Function & { prototype: object };

/** Discriminator for kind of decorated item in {@link DecoratedItem}. */
export type DecoratedKind = "class" | "method" | "property" | "constructor-parameter" | "method-parameter";

export interface DecoratedBase<TMeta> {
	kind: DecoratedKind;
	metadata: MetadataArray<TMeta>;
	/** For class, method, and property; parameters use slot identity only. */
	name: string | symbol;
}

export type DecoratedClass<TMeta> = DecoratedBase<TMeta> & {
	kind: "class";
	name: string;
	target: AnyConstructor;
};

export type DecoratedMethod<TMeta> = DecoratedBase<TMeta> & {
	kind: "method";
	static: boolean;
};

export type DecoratedMethodSingle<TMeta> = Omit<DecoratedMethod<TMeta>, "metadata"> & {
	metadata: TMeta;
};

export type DecoratedProperty<TMeta> = DecoratedBase<TMeta> & {
	kind: "property";
	static: boolean;
};

export type DecoratedPropertySingle<TMeta> = Omit<DecoratedProperty<TMeta>, "metadata"> & {
	metadata: TMeta;
};

export type DecoratedConstructorParameter<TMeta> = Omit<DecoratedBase<TMeta>, "name"> & {
	kind: "constructor-parameter";
	parameterIndex: number;
};

export type DecoratedMethodParameter<TMeta> = Omit<DecoratedBase<TMeta>, "name"> & {
	kind: "method-parameter";
	methodName: string | symbol;
	parameterIndex: number;
	static: boolean;
};

export type DecoratedParameter<TMeta> = DecoratedConstructorParameter<TMeta> | DecoratedMethodParameter<TMeta>;

export type DecoratedItem<TMeta> =
	| DecoratedClass<TMeta>
	| DecoratedMethod<TMeta>
	| DecoratedProperty<TMeta>
	| DecoratedParameter<TMeta>;

/** Reflector pre-bound to a specific metadata key and target class. */
export interface ScopedReflector<TMeta> {
	all(): DecoratedItem<TMeta>[];
	class(): DecoratedClass<TMeta> | undefined;
	methods(): DecoratedMethod<TMeta>[];
	methodsSingular(): DecoratedMethodSingle<TMeta>[];
	parameters(): DecoratedParameter<TMeta>[];
	properties(): DecoratedProperty<TMeta>[];
	propertiesSingular(): DecoratedPropertySingle<TMeta>[];
}
