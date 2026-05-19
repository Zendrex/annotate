import type { Cardinality, MetadataArray, MetadataKey } from "../metadata/types";
import type { AnyConstructor, ScopedReflector } from "../reflector/types";
import type { ValidatorFn } from "./validator-types";

export type { ValidateContext, ValidatorFn } from "./validator-types";

// biome-ignore lint/suspicious/noExplicitAny: required for variance on TMethod
export type AnyFn = (...args: any[]) => any;

export interface InterceptorContext {
	kind: "method" | "accessor" | "field";
	name: string | symbol;
	static: boolean;
}

type ComposeRequirement<TMeta, TArgs extends unknown[]> = [TArgs] extends [[TMeta]]
	? { compose?: (...args: TArgs) => TMeta }
	: { compose: (...args: TArgs) => TMeta };

export type DecoratorOptions<TMeta, TArgs extends unknown[] = [TMeta]> = {
	name?: string;
	requireInstanceOf?: AnyConstructor;
	validate?: ValidatorFn<TMeta>;
} & ComposeRequirement<TMeta, TArgs>;

export type DeriveOptions<TMeta, TArgs extends unknown[]> = Pick<
	DecoratorOptions<TMeta, TArgs>,
	"requireInstanceOf" | "validate" | "name"
>;

export type MethodInterceptorOptions<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TMethod extends AnyFn = AnyFn,
> = DecoratorOptions<TMeta, TArgs> & {
	intercept: (original: TMethod, readMetadata: (instance: object) => TMeta[], context: InterceptorContext) => TMethod;
};

export type AccessorInterceptorOptions<TMeta, TArgs extends unknown[] = [TMeta], TValue = unknown> = DecoratorOptions<
	TMeta,
	TArgs
> & {
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
};

/** See `createFieldInterceptor` for the addInitializer-based replacement strategy (Bun 1.3). */
export type FieldInterceptorOptions<TMeta, TArgs extends unknown[] = [TMeta], TField = unknown> = DecoratorOptions<
	TMeta,
	TArgs
> & {
	onInit: (initial: TField, readMetadata: (instance: object) => TMeta[], context: InterceptorContext) => TField;
};

// biome-ignore lint/suspicious/noExplicitAny: structural Stage-3 generic shape
export type AnyClass<TInstance> = abstract new (...args: any[]) => TInstance;

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

export type DecoratedClassFactory<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TInstance = unknown,
	TCard extends Cardinality = "unique",
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

export type DecoratedMethodFactory<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TMethod extends AnyFn = AnyFn,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
	TCard extends Cardinality = "unique",
> = MethodDecoratorFn<TThis, TMethod, TArgs> & {
	key: MetadataKey<TMeta, TCard>;
	reader(target: object): ScopedReflector<TMeta, TCard>;
	first(target: object, name: string | symbol): TMeta | undefined;
	firstOrThrow(target: object, name: string | symbol): TMeta;
	has(target: object, name: string | symbol): boolean;
	hasOwn(target: object, name: string | symbol): boolean;
	all(target: object, name: string | symbol): MetadataArray<TMeta>;
	derive<TNewThis = TThis>(
		options?: DeriveOptions<TMeta, TArgs>
	): DecoratedMethodFactory<TMeta, TArgs, TMethod, TNewThis, TCard>;
};

export type DecoratedPropertyFactory<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TField = unknown,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
	TCard extends Cardinality = "unique",
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

export type DecoratedAccessorFactory<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TValue = unknown,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
	TCard extends Cardinality = "unique",
> = AccessorDecoratorFn<TThis, TValue, TArgs> & {
	key: MetadataKey<TMeta, TCard>;
	reader(target: object): ScopedReflector<TMeta, TCard>;
	first(target: object, name: string | symbol): TMeta | undefined;
	firstOrThrow(target: object, name: string | symbol): TMeta;
	has(target: object, name: string | symbol): boolean;
	hasOwn(target: object, name: string | symbol): boolean;
	all(target: object, name: string | symbol): MetadataArray<TMeta>;
	derive<TNewThis = TThis>(
		options?: DeriveOptions<TMeta, TArgs>
	): DecoratedAccessorFactory<TMeta, TArgs, TValue, TNewThis, TCard>;
};

// biome-ignore lint/suspicious/noExplicitAny: structural value/method slot intentionally erased by this helper
type _Any = any;

type FactoryGenerics<F> =
	F extends DecoratedClassFactory<infer M, infer A, infer T, infer C>
		? { meta: M; args: A; this: T; card: C }
		: F extends DecoratedMethodFactory<infer M, infer A, _Any, infer T, infer C>
			? { meta: M; args: A; this: T; card: C }
			: F extends DecoratedPropertyFactory<infer M, infer A, _Any, infer T, infer C>
				? { meta: M; args: A; this: T; card: C }
				: F extends DecoratedAccessorFactory<infer M, infer A, _Any, infer T, infer C>
					? { meta: M; args: A; this: T; card: C }
					: never;

type _Slot<F, K extends "meta" | "args" | "this" | "card"> = [FactoryGenerics<F>] extends [never]
	? never
	: FactoryGenerics<F> extends Record<K, infer V>
		? V
		: never;

export type MetadataOf<F> = _Slot<F, "meta">;

export type ArgsOf<F> = _Slot<F, "args">;

export type ThisOf<F> = _Slot<F, "this">;

export type CardinalityOf<F> = _Slot<F, "card">;
