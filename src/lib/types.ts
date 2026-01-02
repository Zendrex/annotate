/** A class constructor (any function with a prototype). */
// biome-ignore lint/complexity/noBannedTypes: needed for constructor type
export type AnyConstructor = Function & { prototype: object };

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Types
// ─────────────────────────────────────────────────────────────────────────────

/** Unique key used to store decorator metadata. */
export type MetadataKey = symbol;

/** Metadata is stored as an array to preserve decorator application order. */
export type MetadataArray<T> = T[];

/** Parameter metadata maps parameter indexes to their metadata arrays. */
export type ParameterMetadataMap<T> = Map<number, MetadataArray<T>>;

// ─────────────────────────────────────────────────────────────────────────────
// Decorator Option Types
// ─────────────────────────────────────────────────────────────────────────────

export type PropertyGetter = (this: unknown) => unknown;
export type PropertySetter = (this: unknown, value: unknown) => void;

export interface InterceptorContext {
	target: object;
	propertyKey: string | symbol;
	descriptor: PropertyDescriptor;
}

/** Options for method interceptor decorators. */
export interface MethodInterceptorOptions<TMeta, TArgs extends unknown[] = [TMeta]> {
	compose?: (...args: TArgs) => TMeta;
	interceptor: (
		original: (...args: unknown[]) => unknown,
		metadata: TMeta[],
		context: InterceptorContext,
	) => (...args: unknown[]) => unknown;
}

/** Options for property interceptor decorators. */
export interface PropertyInterceptorOptions<TMeta, TArgs extends unknown[] = [TMeta]> {
	compose?: (...args: TArgs) => TMeta;
	onGet?: (original: PropertyGetter, metadata: TMeta[], context: InterceptorContext) => PropertyGetter;
	onSet?: (original: PropertySetter, metadata: TMeta[], context: InterceptorContext) => PropertySetter;
}

// ─────────────────────────────────────────────────────────────────────────────
// Decorator Factory Types
// ─────────────────────────────────────────────────────────────────────────────

export type ClassDecoratorFactory<TMeta, TArgs extends unknown[] = [TMeta]> = (...args: TArgs) => ClassDecorator;

export type MethodDecoratorFactory<TMeta, TArgs extends unknown[] = [TMeta]> = (
	...args: TArgs
) => (target: object, propertyKey: string | symbol, descriptor?: PropertyDescriptor) => void;

export type PropertyDecoratorFactory<TMeta, TArgs extends unknown[] = [TMeta]> = (
	...args: TArgs
) => (target: object, propertyKey: string | symbol) => void;

export type ParameterDecoratorFactory<TMeta, TArgs extends unknown[] = [TMeta]> = (
	...args: TArgs
) => (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Decorated Factory Types (with reflection methods)
// ─────────────────────────────────────────────────────────────────────────────

/** Reflection methods attached to class decorator factories. */
export interface ClassDecoratorReflection<TMeta> {
	/** Returns a ScopedReflector bound to this decorator's key. */
	reflect(target: AnyConstructor): ScopedReflector<TMeta>;
	/** Shorthand to get class-level metadata. */
	class(target: AnyConstructor): DecoratedClass<TMeta>[];
	/** Get the metadata key for this decorator. */
	readonly key: MetadataKey;
}

/** Reflection methods attached to method decorator factories. */
export interface MethodDecoratorReflection<TMeta> {
	/** Returns a ScopedReflector bound to this decorator's key. */
	reflect(target: AnyConstructor): ScopedReflector<TMeta>;
	/** Shorthand to get method metadata. */
	methods(target: AnyConstructor): DecoratedMethod<TMeta>[];
	/** Get the metadata key for this decorator. */
	readonly key: MetadataKey;
}

/** Reflection methods attached to property decorator factories. */
export interface PropertyDecoratorReflection<TMeta> {
	/** Returns a ScopedReflector bound to this decorator's key. */
	reflect(target: AnyConstructor): ScopedReflector<TMeta>;
	/** Shorthand to get property metadata. */
	properties(target: AnyConstructor): DecoratedProperty<TMeta>[];
	/** Get the metadata key for this decorator. */
	readonly key: MetadataKey;
}

/** Reflection methods attached to parameter decorator factories. */
export interface ParameterDecoratorReflection<TMeta> {
	/** Returns a ScopedReflector bound to this decorator's key. */
	reflect(target: AnyConstructor): ScopedReflector<TMeta>;
	/** Shorthand to get parameter metadata. */
	parameters(target: AnyConstructor): DecoratedParameter<TMeta>[];
	/** Get the metadata key for this decorator. */
	readonly key: MetadataKey;
}

/** A class decorator factory with attached reflection methods. */
export type DecoratedClassFactory<TMeta, TArgs extends unknown[] = [TMeta]> = ClassDecoratorFactory<TMeta, TArgs> &
	ClassDecoratorReflection<TMeta>;

/** A method decorator factory with attached reflection methods. */
export type DecoratedMethodFactory<TMeta, TArgs extends unknown[] = [TMeta]> = MethodDecoratorFactory<TMeta, TArgs> &
	MethodDecoratorReflection<TMeta>;

/** A property decorator factory with attached reflection methods. */
export type DecoratedPropertyFactory<TMeta, TArgs extends unknown[] = [TMeta]> = PropertyDecoratorFactory<
	TMeta,
	TArgs
> &
	PropertyDecoratorReflection<TMeta>;

/** A parameter decorator factory with attached reflection methods. */
export type DecoratedParameterFactory<TMeta, TArgs extends unknown[] = [TMeta]> = ParameterDecoratorFactory<
	TMeta,
	TArgs
> &
	ParameterDecoratorReflection<TMeta>;

// ─────────────────────────────────────────────────────────────────────────────
// Scoped Reflector Type
// ─────────────────────────────────────────────────────────────────────────────

/** A reflector pre-bound to a specific metadata key. */
export interface ScopedReflector<TMeta> {
	/** Get all decorated items for this key. */
	all(): DecoratedItem<TMeta>[];
	/** Get class-level metadata. */
	class(): DecoratedClass<TMeta>[];
	/** Get method metadata (instance + static). */
	methods(): DecoratedMethod<TMeta>[];
	/** Get property metadata (instance + static). */
	properties(): DecoratedProperty<TMeta>[];
	/** Get parameter metadata (constructor + methods). */
	parameters(): DecoratedParameter<TMeta>[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Reflection Types
// ─────────────────────────────────────────────────────────────────────────────

export type DecoratedKind = "class" | "method" | "property" | "parameter";

interface DecoratedBase<TMeta> {
	kind: DecoratedKind;
	name: string | symbol;
	metadata: MetadataArray<TMeta>;
}

export type DecoratedClass<TMeta> = DecoratedBase<TMeta> & {
	kind: "class";
	// biome-ignore lint/complexity/noBannedTypes: needed for constructor type
	target: Function & { prototype: object };
};

export type DecoratedMethod<TMeta> = DecoratedBase<TMeta> & {
	kind: "method";
	target: (...args: unknown[]) => unknown;
};

export type DecoratedProperty<TMeta> = DecoratedBase<TMeta> & {
	kind: "property";
};

export type DecoratedParameter<TMeta> = DecoratedBase<TMeta> & {
	kind: "parameter";
	parameterIndex: number;
};

export type DecoratedItem<TMeta> =
	| DecoratedClass<TMeta>
	| DecoratedMethod<TMeta>
	| DecoratedProperty<TMeta>
	| DecoratedParameter<TMeta>;
