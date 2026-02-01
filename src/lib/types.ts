import {
	createClassDecorator,
	createMethodDecorator,
	createParameterDecorator,
	createPropertyDecorator,
} from "./factories";
import { Reflector } from "./reflector";

/**
 * A class constructor (any function with a prototype).
 *
 * This is a permissive type that accepts any constructor, including
 * abstract classes and built-in constructors like `Function`.
 *
 * @see {@link DecoratedClass} for decorated class metadata
 */
// biome-ignore lint/complexity/noBannedTypes: needed for constructor type
export type AnyConstructor = Function & { prototype: object };

/**
 * Unique key used to store decorator metadata.
 *
 * Each decorator factory creates a unique symbol key to avoid
 * collisions between different decorators on the same target.
 */
export type MetadataKey = symbol;

/**
 * Metadata is stored as an array to preserve decorator application order.
 *
 * When multiple decorators of the same type are applied to a target,
 * their metadata is collected in the order they were applied (bottom-up
 * for stacked decorators).
 *
 * @typeParam T - The type of metadata stored by the decorator
 */
export type MetadataArray<T> = T[];

/**
 * Parameter metadata maps parameter indexes to their metadata arrays.
 *
 * Used internally to store metadata for decorated constructor and method
 * parameters. The map key is the zero-based parameter index.
 *
 * @typeParam T - The type of metadata stored for each parameter
 */
export type ParameterMetadataMap<T> = Map<number, MetadataArray<T>>;

/** Function signature for property getters in interceptor decorators. */
export type PropertyGetter = (this: unknown) => unknown;

/** Function signature for property setters in interceptor decorators. */
export type PropertySetter = (this: unknown, value: unknown) => void;

/**
 * Context passed to interceptor callbacks.
 *
 * Provides access to the decoration target and its property descriptor,
 * allowing interceptors to inspect and modify behavior.
 */
export interface InterceptorContext {
	/** The object that owns the decorated member (prototype for instance members, constructor for static). */
	target: object;
	/** The name of the decorated property or method. */
	propertyKey: string | symbol;
	/** The property descriptor for the decorated member. */
	descriptor: PropertyDescriptor;
}

/**
 * Options for creating method interceptor decorators.
 *
 * Method interceptors wrap the original method implementation, allowing
 * cross-cutting concerns like logging, validation, or caching to be
 * applied declaratively via decorators.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 *
 * @see {@link createMethodDecorator}
 */
export interface MethodInterceptorOptions<TMeta, TArgs extends unknown[] = [TMeta]> {
	/**
	 * Optional function to compose decorator arguments into metadata.
	 * If not provided, the first argument is used as-is.
	 *
	 * @param args - The arguments passed to the decorator factory
	 * @returns The composed metadata value
	 */
	compose?: (...args: TArgs) => TMeta;
	/**
	 * The interceptor function that wraps the original method.
	 *
	 * @param original - The original method implementation
	 * @param metadata - Array of all metadata applied to this method
	 * @param context - Context with target, property key, and descriptor
	 * @returns A replacement function that will be called instead of the original
	 */
	interceptor: (
		original: (...args: unknown[]) => unknown,
		metadata: TMeta[],
		context: InterceptorContext,
	) => (...args: unknown[]) => unknown;
}

/**
 * Options for creating property interceptor decorators.
 *
 * Property interceptors can wrap getter and/or setter access, enabling
 * features like lazy initialization, validation, or change tracking.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 *
 * @see {@link createPropertyDecorator}
 */
export interface PropertyInterceptorOptions<TMeta, TArgs extends unknown[] = [TMeta]> {
	/**
	 * Optional function to compose decorator arguments into metadata.
	 * If not provided, the first argument is used as-is.
	 *
	 * @param args - The arguments passed to the decorator factory
	 * @returns The composed metadata value
	 */
	compose?: (...args: TArgs) => TMeta;
	/**
	 * Optional interceptor for property get access.
	 *
	 * @param original - The original getter (or a default that returns the backing value)
	 * @param metadata - Array of all metadata applied to this property
	 * @param context - Context with target, property key, and descriptor
	 * @returns A replacement getter function
	 */
	onGet?: (original: PropertyGetter, metadata: TMeta[], context: InterceptorContext) => PropertyGetter;
	/**
	 * Optional interceptor for property set access.
	 *
	 * @param original - The original setter (or a default that sets the backing value)
	 * @param metadata - Array of all metadata applied to this property
	 * @param context - Context with target, property key, and descriptor
	 * @returns A replacement setter function
	 */
	onSet?: (original: PropertySetter, metadata: TMeta[], context: InterceptorContext) => PropertySetter;
}

/**
 * A factory function that creates class decorators.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the factory (defaults to `[TMeta]`)
 *
 * @see {@link createClassDecorator}
 */
export type ClassDecoratorFactory<TMeta, TArgs extends unknown[] = [TMeta]> = (...args: TArgs) => ClassDecorator;

/**
 * A factory function that creates method decorators.
 *
 * The returned decorator can be applied to both instance and static methods.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the factory (defaults to `[TMeta]`)
 *
 * @see {@link createMethodDecorator}
 */
export type MethodDecoratorFactory<TMeta, TArgs extends unknown[] = [TMeta]> = (
	...args: TArgs
) => (target: object, propertyKey: string | symbol, descriptor?: PropertyDescriptor) => void;

/**
 * A factory function that creates property decorators.
 *
 * The returned decorator can be applied to both instance and static properties.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the factory (defaults to `[TMeta]`)
 *
 * @see {@link createPropertyDecorator}
 */
export type PropertyDecoratorFactory<TMeta, TArgs extends unknown[] = [TMeta]> = (
	...args: TArgs
) => (target: object, propertyKey: string | symbol) => void;

/**
 * A factory function that creates parameter decorators.
 *
 * The returned decorator can be applied to constructor parameters
 * (when `propertyKey` is `undefined`) or method parameters.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the factory (defaults to `[TMeta]`)
 *
 * @see {@link createParameterDecorator}
 */
export type ParameterDecoratorFactory<TMeta, TArgs extends unknown[] = [TMeta]> = (
	...args: TArgs
) => (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => void;

/**
 * Reflection methods attached to class decorator factories.
 *
 * These methods enable runtime introspection of decorated classes
 * without accessing the global {@link Reflector} directly.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 */
export interface ClassDecoratorReflection<TMeta> {
	/**
	 * Returns a {@link ScopedReflector} bound to this decorator's key.
	 *
	 * @param target - The class constructor to reflect on
	 * @returns A scoped reflector for querying this decorator's metadata
	 */
	reflect(target: AnyConstructor): ScopedReflector<TMeta>;
	/**
	 * Shorthand to get class-level metadata for a specific class.
	 *
	 * @param target - The class constructor to query
	 * @returns Array of decorated class entries (typically one per class)
	 */
	class(target: AnyConstructor): DecoratedClass<TMeta>[];
	/**
	 * The unique metadata key for this decorator.
	 *
	 * Can be used with the global {@link Reflector} for advanced queries.
	 */
	readonly key: MetadataKey;
}

/**
 * Reflection methods attached to method decorator factories.
 *
 * These methods enable runtime introspection of decorated methods
 * without accessing the global {@link Reflector} directly.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 */
export interface MethodDecoratorReflection<TMeta> {
	/**
	 * Returns a {@link ScopedReflector} bound to this decorator's key.
	 *
	 * @param target - The class constructor to reflect on
	 * @returns A scoped reflector for querying this decorator's metadata
	 */
	reflect(target: AnyConstructor): ScopedReflector<TMeta>;
	/**
	 * Shorthand to get method metadata for a specific class.
	 *
	 * @param target - The class constructor to query
	 * @returns Array of decorated method entries (instance and static)
	 */
	methods(target: AnyConstructor): DecoratedMethod<TMeta>[];
	/**
	 * The unique metadata key for this decorator.
	 *
	 * Can be used with the global {@link Reflector} for advanced queries.
	 */
	readonly key: MetadataKey;
}

/**
 * Reflection methods attached to property decorator factories.
 *
 * These methods enable runtime introspection of decorated properties
 * without accessing the global {@link Reflector} directly.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 */
export interface PropertyDecoratorReflection<TMeta> {
	/**
	 * Returns a {@link ScopedReflector} bound to this decorator's key.
	 *
	 * @param target - The class constructor to reflect on
	 * @returns A scoped reflector for querying this decorator's metadata
	 */
	reflect(target: AnyConstructor): ScopedReflector<TMeta>;
	/**
	 * Shorthand to get property metadata for a specific class.
	 *
	 * @param target - The class constructor to query
	 * @returns Array of decorated property entries (instance and static)
	 */
	properties(target: AnyConstructor): DecoratedProperty<TMeta>[];
	/**
	 * The unique metadata key for this decorator.
	 *
	 * Can be used with the global {@link Reflector} for advanced queries.
	 */
	readonly key: MetadataKey;
}

/**
 * Reflection methods attached to parameter decorator factories.
 *
 * These methods enable runtime introspection of decorated parameters
 * without accessing the global {@link Reflector} directly.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 */
export interface ParameterDecoratorReflection<TMeta> {
	/**
	 * Returns a {@link ScopedReflector} bound to this decorator's key.
	 *
	 * @param target - The class constructor to reflect on
	 * @returns A scoped reflector for querying this decorator's metadata
	 */
	reflect(target: AnyConstructor): ScopedReflector<TMeta>;
	/**
	 * Shorthand to get parameter metadata for a specific class.
	 *
	 * @param target - The class constructor to query
	 * @returns Array of decorated parameter entries (constructor and method params)
	 */
	parameters(target: AnyConstructor): DecoratedParameter<TMeta>[];
	/**
	 * The unique metadata key for this decorator.
	 *
	 * Can be used with the global {@link Reflector} for advanced queries.
	 */
	readonly key: MetadataKey;
}

/**
 * A class decorator factory with attached reflection methods.
 *
 * Created by {@link createClassDecorator}, this type combines the ability
 * to create class decorators with convenient reflection shortcuts.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the factory (defaults to `[TMeta]`)
 */
export type DecoratedClassFactory<TMeta, TArgs extends unknown[] = [TMeta]> = ClassDecoratorFactory<TMeta, TArgs> &
	ClassDecoratorReflection<TMeta>;

/**
 * A method decorator factory with attached reflection methods.
 *
 * Created by {@link createMethodDecorator}, this type combines the ability
 * to create method decorators with convenient reflection shortcuts.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the factory (defaults to `[TMeta]`)
 */
export type DecoratedMethodFactory<TMeta, TArgs extends unknown[] = [TMeta]> = MethodDecoratorFactory<TMeta, TArgs> &
	MethodDecoratorReflection<TMeta>;

/**
 * A property decorator factory with attached reflection methods.
 *
 * Created by {@link createPropertyDecorator}, this type combines the ability
 * to create property decorators with convenient reflection shortcuts.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the factory (defaults to `[TMeta]`)
 */
export type DecoratedPropertyFactory<TMeta, TArgs extends unknown[] = [TMeta]> = PropertyDecoratorFactory<
	TMeta,
	TArgs
> &
	PropertyDecoratorReflection<TMeta>;

/**
 * A parameter decorator factory with attached reflection methods.
 *
 * Created by {@link createParameterDecorator}, this type combines the ability
 * to create parameter decorators with convenient reflection shortcuts.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the factory (defaults to `[TMeta]`)
 */
export type DecoratedParameterFactory<TMeta, TArgs extends unknown[] = [TMeta]> = ParameterDecoratorFactory<
	TMeta,
	TArgs
> &
	ParameterDecoratorReflection<TMeta>;

/**
 * A reflector pre-bound to a specific metadata key and target class.
 *
 * Provides convenient methods to query decorated items without repeatedly
 * specifying the metadata key. Created via the `reflect()` method on
 * decorator factories.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 */
export interface ScopedReflector<TMeta> {
	/**
	 * Get all decorated items for this key (class, methods, properties, parameters).
	 *
	 * @returns Array of all decorated items regardless of kind
	 */
	all(): DecoratedItem<TMeta>[];
	/**
	 * Get class-level metadata.
	 *
	 * @returns Array of decorated class entries
	 */
	class(): DecoratedClass<TMeta>[];
	/**
	 * Get method metadata (instance + static).
	 *
	 * @returns Array of decorated method entries
	 */
	methods(): DecoratedMethod<TMeta>[];
	/**
	 * Get property metadata (instance + static).
	 *
	 * @returns Array of decorated property entries
	 */
	properties(): DecoratedProperty<TMeta>[];
	/**
	 * Get parameter metadata (constructor + methods).
	 *
	 * @returns Array of decorated parameter entries
	 */
	parameters(): DecoratedParameter<TMeta>[];
}

/** Discriminator for the kind of decorated item in {@link DecoratedItem}. */
export type DecoratedKind = "class" | "method" | "property" | "parameter";

/**
 * Base interface for all decorated item types.
 *
 * Contains common fields shared by all decoration targets.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 */
interface DecoratedBase<TMeta> {
	/** The kind of decorated item for type discrimination. */
	kind: DecoratedKind;
	/** The name of the decorated item (class name, method/property key). */
	name: string | symbol;
	/** Array of metadata values applied to this item, in decorator application order. */
	metadata: MetadataArray<TMeta>;
}

/**
 * Metadata for a decorated class.
 *
 * Returned when querying class-level decorators via reflection.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 */
export type DecoratedClass<TMeta> = DecoratedBase<TMeta> & {
	/** Discriminator indicating this is class-level metadata. */
	kind: "class";
	/** The decorated class constructor. */
	// biome-ignore lint/complexity/noBannedTypes: needed for constructor type
	target: Function & { prototype: object };
};

/**
 * Metadata for a decorated method.
 *
 * Returned when querying method decorators via reflection.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 */
export type DecoratedMethod<TMeta> = DecoratedBase<TMeta> & {
	/** Discriminator indicating this is method metadata. */
	kind: "method";
	/** The decorated method function. */
	target: (...args: unknown[]) => unknown;
};

/**
 * Metadata for a decorated property.
 *
 * Returned when querying property decorators via reflection.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 */
export type DecoratedProperty<TMeta> = DecoratedBase<TMeta> & {
	/** Discriminator indicating this is property metadata. */
	kind: "property";
};

/**
 * Metadata for a decorated parameter.
 *
 * Returned when querying parameter decorators via reflection.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 */
export type DecoratedParameter<TMeta> = DecoratedBase<TMeta> & {
	/** Discriminator indicating this is parameter metadata. */
	kind: "parameter";
	/** The zero-based index of the decorated parameter. */
	parameterIndex: number;
};

/**
 * Union type of all decorated item types.
 *
 * Use the `kind` discriminator to narrow to a specific type.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 */
export type DecoratedItem<TMeta> =
	| DecoratedClass<TMeta>
	| DecoratedMethod<TMeta>
	| DecoratedProperty<TMeta>
	| DecoratedParameter<TMeta>;
