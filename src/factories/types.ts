import type { MetadataKey } from "../metadata/types";
import type { ScopedReflector } from "../reflector/types";

/** Bound to the instance (or constructor for statics) at access time. */
export type PropertyGetter = (this: unknown) => unknown;

/** Bound to the instance (or constructor for statics) at access time. */
export type PropertySetter = (this: unknown, value: unknown) => void;

/**
 * Describes the decorated site being intercepted.
 *
 * `owner` is the declaring object — the prototype for instance members, the
 * constructor for static members. Mutating `descriptor` from an interceptor
 * callback is not supported; install behavior through the returned function.
 */
export interface InterceptorContext {
	descriptor: PropertyDescriptor;
	name: string | symbol;
	owner: object;
}

/**
 * Shared factory configuration for class, method, property, and interceptor
 * decorators.
 *
 * - `compose` maps the decorator's call arguments to the stored metadata shape.
 *   Omit it when `TArgs` is `[TMeta]` (the default) and no transformation is needed.
 * - `name` is used as a prefix in `AnnotateError` messages to aid debugging.
 * - `unique` causes a second application on the same target to throw
 *   `AnnotateError` with `code: "duplicate"`. Not supported by parameter decorators.
 *
 * @typeParam TMeta - Metadata value stored per application
 * @typeParam TArgs - Call arguments passed to the decorator; defaults to `[TMeta]`
 */
export interface DecoratorOptions<TMeta, TArgs extends unknown[] = [TMeta]> {
	compose?: (...args: TArgs) => TMeta;
	name?: string;
	unique?: boolean;
}

/**
 * Options for parameter decorators. `unique` is not available because parameter
 * metadata is keyed by parameter slot and always appends.
 */
export type ParameterDecoratorOptions<TMeta, TArgs extends unknown[] = [TMeta]> = Omit<
	DecoratorOptions<TMeta, TArgs>,
	"unique"
>;

/**
 * Options for {@link createMethodInterceptor}.
 *
 * `intercept` returns a replacement function installed onto the method's property
 * descriptor. The replacement's `name` is restored to the original to preserve
 * stack traces and `Function.prototype.name` lookups.
 */
export interface MethodInterceptorOptions<TMeta, TArgs extends unknown[] = [TMeta]>
	extends DecoratorOptions<TMeta, TArgs> {
	intercept: (
		original: (...args: unknown[]) => unknown,
		metadata: TMeta[],
		context: InterceptorContext
	) => (...args: unknown[]) => unknown;
}

/**
 * Options for {@link createPropertyInterceptor}. At least one of `onGet` or
 * `onSet` must be provided; omitting both causes the factory to throw `TypeError`.
 *
 * Each hook receives the existing accessor (or a synthesized one wrapping the
 * underlying data property) and must return a replacement with the same signature.
 */
export interface PropertyInterceptorOptions<TMeta, TArgs extends unknown[] = [TMeta]>
	extends DecoratorOptions<TMeta, TArgs> {
	onGet?: (original: PropertyGetter, metadata: TMeta[], context: InterceptorContext) => PropertyGetter;
	onSet?: (original: PropertySetter, metadata: TMeta[], context: InterceptorContext) => PropertySetter;
}

export type ClassDecoratorFactory<TMeta, TArgs extends unknown[] = [TMeta]> = (...args: TArgs) => (
	// biome-ignore lint/complexity/noBannedTypes: class decorator target shape from TS
	target: Function
) => void;

export type MethodDecoratorFactory<TMeta, TArgs extends unknown[] = [TMeta]> = (
	...args: TArgs
) => (target: object, propertyKey: string | symbol, descriptor?: PropertyDescriptor) => void;

export type PropertyDecoratorFactory<TMeta, TArgs extends unknown[] = [TMeta]> = (
	...args: TArgs
) => (target: object, propertyKey: string | symbol) => void;

export type ParameterDecoratorFactory<TMeta, TArgs extends unknown[] = [TMeta]> = (
	...args: TArgs
) => (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => void;

// --- Class factory surface ---

/**
 * Callable decorator produced by {@link createClassDecorator}, augmented with
 * reflection helpers pre-bound to this factory's metadata key.
 *
 * All `target` arguments accept a class constructor or an instance (resolved to
 * its constructor). `metadata` / `applied` walk the prototype chain, so
 * subclasses see parent decoration; use `appliedOwn` to exclude inherited state.
 *
 * @typeParam TMeta - Metadata stored per decorator application
 * @typeParam TArgs - Arguments accepted by the decorator call
 */
export type DecoratedClassFactory<TMeta, TArgs extends unknown[] = [TMeta]> = ClassDecoratorFactory<TMeta, TArgs> & {
	key: MetadataKey;
	reflect(target: object): ScopedReflector<TMeta>;
	/** First stored value (per declaration order), walking the prototype chain. */
	metadata(target: object): TMeta | undefined;
	/** Like {@link DecoratedClassFactory.metadata} but throws `AnnotateError` with `code: "missing"` when absent. */
	requireMetadata(target: object): TMeta;
	applied(target: object): boolean;
	appliedOwn(target: object): boolean;
};

// --- Method / property factory surface ---

/**
 * Callable decorator produced by {@link createMethodDecorator} or
 * {@link createMethodInterceptor}, plus reflection helpers scoped to methods.
 *
 * The `name` argument addresses the method by property key; static and instance
 * methods are looked up on the constructor or prototype respectively during
 * reflection.
 */
export type DecoratedMethodFactory<TMeta, TArgs extends unknown[] = [TMeta]> = MethodDecoratorFactory<TMeta, TArgs> & {
	key: MetadataKey;
	reflect(target: object): ScopedReflector<TMeta>;
	metadata(target: object, name: string | symbol): TMeta | undefined;
	/** @throws `AnnotateError` with `code: "missing"` when no metadata is registered on `name`. */
	requireMetadata(target: object, name: string | symbol): TMeta;
	applied(target: object, name: string | symbol): boolean;
	appliedOwn(target: object, name: string | symbol): boolean;
};

/**
 * Callable decorator produced by {@link createPropertyDecorator} or
 * {@link createPropertyInterceptor}, plus reflection helpers scoped to properties.
 */
export type DecoratedPropertyFactory<TMeta, TArgs extends unknown[] = [TMeta]> = PropertyDecoratorFactory<
	TMeta,
	TArgs
> & {
	key: MetadataKey;
	reflect(target: object): ScopedReflector<TMeta>;
	metadata(target: object, name: string | symbol): TMeta | undefined;
	/** @throws `AnnotateError` with `code: "missing"` when no metadata is registered on `name`. */
	requireMetadata(target: object, name: string | symbol): TMeta;
	applied(target: object, name: string | symbol): boolean;
	appliedOwn(target: object, name: string | symbol): boolean;
};

// --- Parameter factory surface ---

/**
 * Callable decorator produced by {@link createParameterDecorator}, plus
 * reflection helpers scoped to parameters.
 *
 * Omit `methodName` to address constructor parameters; supply it for method
 * parameters. The same `parameterIndex` namespace is independent per method.
 */
export type DecoratedParameterFactory<TMeta, TArgs extends unknown[] = [TMeta]> = ParameterDecoratorFactory<
	TMeta,
	TArgs
> & {
	key: MetadataKey;
	reflect(target: object): ScopedReflector<TMeta>;
	metadata(target: object, parameterIndex: number, methodName?: string | symbol): TMeta | undefined;
	/** @throws `AnnotateError` with `code: "missing"` when the slot has no metadata. */
	requireMetadata(target: object, parameterIndex: number, methodName?: string | symbol): TMeta;
	applied(target: object, parameterIndex: number, methodName?: string | symbol): boolean;
	appliedOwn(target: object, parameterIndex: number, methodName?: string | symbol): boolean;
};
