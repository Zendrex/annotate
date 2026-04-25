import type { MetadataArray, MetadataKey } from "../metadata/types";
import type { AnyConstructor, ScopedReflector } from "../reflector/types";
import type { ValidatorFn } from "./validator-types";

/**
 * Re-exports: {@link ValidateContext}, {@link ValidatorFn}.
 * Declares Stage 3 decorator factory surfaces and interceptor options for this package.
 */
export type { ValidateContext, ValidatorFn } from "./validator-types";

/** Structural stand-in for any function type used in method/accessor factory generics. */
// biome-ignore lint/suspicious/noExplicitAny: required for variance on TMethod
export type AnyFn = (...args: any[]) => any;

/** Carried into interceptor callbacks so implementations know which member is wrapped. */
export interface InterceptorContext {
	kind: "method" | "accessor";
	name: string | symbol;
	static: boolean;
}

/**
 * Common options for class/method/property/accessor factories and interceptors.
 * - `requireInstanceOf` / `validate`: composed into a validator chain (see `buildValidatorChain`).
 * - `compose`: maps decorator arguments to the stored metadata value.
 */
export interface DecoratorOptions<TMeta, TArgs extends unknown[] = [TMeta]> {
	compose?: (...args: TArgs) => TMeta;
	name?: string;
	requireInstanceOf?: AnyConstructor;
	validate?: ValidatorFn<TMeta>;
}

/** Subset of {@link DecoratorOptions} used by `derive()` on a factory. */
export type DeriveOptions<TMeta, TArgs extends unknown[]> = Pick<
	DecoratorOptions<TMeta, TArgs>,
	"requireInstanceOf" | "validate" | "name"
>;

/**
 * Configures `intercept.method`: the returned function replaces the original
 * method; `readMetadata` returns all values stored under this factory’s key
 * for the instance and member.
 */
export interface MethodInterceptorOptions<TMeta, TArgs extends unknown[] = [TMeta], TMethod extends AnyFn = AnyFn>
	extends DecoratorOptions<TMeta, TArgs> {
	intercept: (original: TMethod, readMetadata: (instance: object) => TMeta[], context: InterceptorContext) => TMethod;
}

/**
 * Configures `intercept.accessor`: provide `onGet` and/or `onSet` to wrap
 * the compiler-generated getter/setter for auto-accessors.
 */
export interface AccessorInterceptorOptions<TMeta, TArgs extends unknown[] = [TMeta], TValue = unknown>
	extends DecoratorOptions<TMeta, TArgs> {
	onGet?: (
		original: () => TValue,
		readMetadata: (instance: object) => TMeta[],
		context: InterceptorContext
	) => () => TValue;
	onSet?: (
		original: (value: TValue) => void,
		readMetadata: (instance: object) => TMeta[],
		context: InterceptorContext
	) => (value: TValue) => void;
}

// biome-ignore lint/suspicious/noExplicitAny: structural Stage-3 generic shape
type AnyClass<TInstance> = abstract new (...args: any[]) => TInstance;

export type ClassDecoratorFn<TInstance, TArgs extends unknown[]> = (
	...args: TArgs
) => <T extends AnyClass<TInstance>>(value: T, context: ClassDecoratorContext<T>) => void;

export type FieldDecoratorFn<TThis, TField, TArgs extends unknown[]> = (
	...args: TArgs
) => (value: undefined, context: ClassFieldDecoratorContext<TThis, TField>) => void;

export type MethodDecoratorFn<TThis, TMethod extends AnyFn, TArgs extends unknown[]> = (
	...args: TArgs
) => (value: TMethod, context: ClassMethodDecoratorContext<TThis, TMethod>) => TMethod | undefined;

export type AccessorDecoratorFn<TThis, TValue, TArgs extends unknown[]> = (
	...args: TArgs
) => (
	value: ClassAccessorDecoratorTarget<TThis, TValue>,
	context: ClassAccessorDecoratorContext<TThis, TValue>
) => ClassAccessorDecoratorResult<TThis, TValue> | undefined;

/**
 * A class decorator factory plus `key`, `reader` / `first` / `all`, and
 * `derive` for the same key with stricter instance typing.
 *
 * `TCard` carries the cardinality brand (`"unique"` or `"list"`), exposed via
 * `.key`. The `reader` return type narrows on `TCard` so callers get
 * scalar `metadata` for unique keys and array `metadata` for list keys.
 */
export type DecoratedClassFactory<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TInstance = unknown,
	TCard extends "unique" | "list" = "unique",
> = ClassDecoratorFn<TInstance, TArgs> & {
	key: MetadataKey<TMeta, TCard>;
	reader(target: object): ScopedReflector<TMeta, TCard>;
	first(target: object): TMeta | undefined;
	firstOrThrow(target: object): TMeta;
	has(target: object): boolean;
	hasOwn(target: object): boolean;
	all(target: object): MetadataArray<TMeta>;
	derive<TNewInstance = TInstance>(
		options?: DeriveOptions<TMeta, TArgs>
	): DecoratedClassFactory<TMeta, TArgs, TNewInstance, TCard>;
};

/**
 * Method decorator plus metadata readers scoped to `(target, name)` and `derive`
 * for alternate method/this types with the same storage key.
 *
 * `TCard` carries the cardinality brand; the `reader` return type narrows on `TCard`
 * so callers get scalar `metadata` for unique keys and array `metadata` for list keys.
 */
export type DecoratedMethodFactory<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TMethod extends AnyFn = AnyFn,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
	TCard extends "unique" | "list" = "unique",
> = MethodDecoratorFn<TThis, TMethod, TArgs> & {
	key: MetadataKey<TMeta, TCard>;
	reader(target: object): ScopedReflector<TMeta, TCard>;
	first(target: object, name: string | symbol): TMeta | undefined;
	firstOrThrow(target: object, name: string | symbol): TMeta;
	has(target: object, name: string | symbol): boolean;
	hasOwn(target: object, name: string | symbol): boolean;
	all(target: object, name: string | symbol): MetadataArray<TMeta>;
	derive<TNewMethod extends AnyFn = TMethod, TNewThis = TThis>(
		options?: DeriveOptions<TMeta, TArgs>
	): DecoratedMethodFactory<TMeta, TArgs, TNewMethod, TNewThis, TCard>;
};

/**
 * Field (Stage 3) decorator with the same reader/derive pattern as method factories.
 *
 * `TCard` carries the cardinality brand; the `reader` return type narrows on `TCard`
 * so callers get scalar `metadata` for unique keys and array `metadata` for list keys.
 */
export type DecoratedPropertyFactory<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TField = unknown,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
	TCard extends "unique" | "list" = "unique",
> = FieldDecoratorFn<TThis, TField, TArgs> & {
	key: MetadataKey<TMeta, TCard>;
	reader(target: object): ScopedReflector<TMeta, TCard>;
	first(target: object, name: string | symbol): TMeta | undefined;
	firstOrThrow(target: object, name: string | symbol): TMeta;
	has(target: object, name: string | symbol): boolean;
	hasOwn(target: object, name: string | symbol): boolean;
	all(target: object, name: string | symbol): MetadataArray<TMeta>;
	derive<TNewField = TField, TNewThis = TThis>(
		options?: DeriveOptions<TMeta, TArgs>
	): DecoratedPropertyFactory<TMeta, TArgs, TNewField, TNewThis, TCard>;
};

/**
 * Class accessor decorator (auto-accessor) with reader APIs; metadata is stored
 * as property-scoped for reflection parity.
 *
 * `TCard` carries the cardinality brand; the `reader` return type narrows on `TCard`
 * so callers get scalar `metadata` for unique keys and array `metadata` for list keys.
 */
export type DecoratedAccessorFactory<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TValue = unknown,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
	TCard extends "unique" | "list" = "unique",
> = AccessorDecoratorFn<TThis, TValue, TArgs> & {
	key: MetadataKey<TMeta, TCard>;
	reader(target: object): ScopedReflector<TMeta, TCard>;
	first(target: object, name: string | symbol): TMeta | undefined;
	firstOrThrow(target: object, name: string | symbol): TMeta;
	has(target: object, name: string | symbol): boolean;
	hasOwn(target: object, name: string | symbol): boolean;
	all(target: object, name: string | symbol): MetadataArray<TMeta>;
	derive<TNewValue = TValue, TNewThis = TThis>(
		options?: DeriveOptions<TMeta, TArgs>
	): DecoratedAccessorFactory<TMeta, TArgs, TNewValue, TNewThis, TCard>;
};

type FactoryGenerics<F> =
	F extends DecoratedClassFactory<infer M, infer A, infer T>
		? { meta: M; args: A; this: T }
		: // biome-ignore lint/suspicious/noExplicitAny: value slot is not captured by this helper
			F extends DecoratedMethodFactory<infer M, infer A, any, infer T>
			? { meta: M; args: A; this: T }
			: // biome-ignore lint/suspicious/noExplicitAny: value slot is not captured by this helper
				F extends DecoratedPropertyFactory<infer M, infer A, any, infer T>
				? { meta: M; args: A; this: T }
				: // biome-ignore lint/suspicious/noExplicitAny: value slot is not captured by this helper
					F extends DecoratedAccessorFactory<infer M, infer A, any, infer T>
					? { meta: M; args: A; this: T }
					: never;

/** Extracts the metadata type `M` from a `Decorated*Factory` type `F`. */
export type MetadataOf<F> = [FactoryGenerics<F>] extends [never]
	? never
	: FactoryGenerics<F> extends { meta: infer M }
		? M
		: never;

/** Decorator argument tuple `A` for factory type `F`. */
export type ArgsOf<F> = [FactoryGenerics<F>] extends [never]
	? never
	: FactoryGenerics<F> extends { args: infer A }
		? A
		: never;

/** Instance / `this` type slot carried by `F` (class instance, method `this`, field, or accessor). */
export type ThisOf<F> = [FactoryGenerics<F>] extends [never]
	? never
	: FactoryGenerics<F> extends { this: infer T }
		? T
		: never;
