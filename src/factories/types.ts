import type { MetadataKey } from "../metadata/types";
import type { ScopedReflector } from "../reflector/types";

/** Shorthand for any function value used as a method-decorator constraint default. */
// biome-ignore lint/suspicious/noExplicitAny: required for variance on TMethod
export type AnyFn = (...args: any[]) => any;

/**
 * Describes the decorated site to interceptor hooks. Drops the `descriptor`
 * and `owner` fields from v0.x — Stage-3 contexts carry the necessary
 * information (`name`, `static`, `kind`) directly.
 *
 * `kind` is `"method"` for `createMethodInterceptor` and `"accessor"` for
 * `createAccessorInterceptor`. Raw `get` / `set`-only interceptors are out
 * of scope for v1 (see plan EA-9).
 */
export interface InterceptorContext {
	kind: "method" | "accessor";
	name: string | symbol;
	static: boolean;
}

export interface DecoratorOptions<TMeta, TArgs extends unknown[] = [TMeta]> {
	compose?: (...args: TArgs) => TMeta;
	name?: string;
	unique?: boolean;
}

export interface MethodInterceptorOptions<TMeta, TArgs extends unknown[] = [TMeta], TMethod extends AnyFn = AnyFn>
	extends DecoratorOptions<TMeta, TArgs> {
	intercept: (original: TMethod, readMetadata: (instance: object) => TMeta[], context: InterceptorContext) => TMethod;
}

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

// --- Decorator function signatures (Stage-3) ---

// biome-ignore lint/suspicious/noExplicitAny: structural Stage-3 generic shape
type AnyClass<TInstance> = abstract new (...args: any[]) => TInstance;

export type ClassDecoratorFn<TInstance, TArgs extends unknown[]> = (
	...args: TArgs
) => <T extends AnyClass<TInstance>>(value: T, context: ClassDecoratorContext<T>) => void;

// EA-3 — default This generic to any, not unknown (matches lib.es2023.decorators.d.ts variance for typical instance members).
export type FieldDecoratorFn<TField, TArgs extends unknown[]> = (
	...args: TArgs
	// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
) => (value: undefined, context: ClassFieldDecoratorContext<any, TField>) => void;

// EA-3 — default This generic to any, not unknown.
export type MethodDecoratorFn<TMethod extends AnyFn, TArgs extends unknown[]> = (
	...args: TArgs
	// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
) => (value: TMethod, context: ClassMethodDecoratorContext<any, TMethod>) => TMethod | undefined;

// EA-3 — default This generic to any, not unknown.
export type AccessorDecoratorFn<TValue, TArgs extends unknown[]> = (...args: TArgs) => (
	// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
	value: ClassAccessorDecoratorTarget<any, TValue>,
	// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
	context: ClassAccessorDecoratorContext<any, TValue>
	// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
) => ClassAccessorDecoratorResult<any, TValue> | undefined;

// --- Factory surfaces ---

export type DecoratedClassFactory<TMeta, TArgs extends unknown[] = [TMeta], TInstance = unknown> = ClassDecoratorFn<
	TInstance,
	TArgs
> & {
	key: MetadataKey;
	reflect(target: object): ScopedReflector<TMeta>;
	metadata(target: object): TMeta | undefined;
	requireMetadata(target: object): TMeta;
	applied(target: object): boolean;
	appliedOwn(target: object): boolean;
};

export type DecoratedMethodFactory<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TMethod extends AnyFn = AnyFn,
> = MethodDecoratorFn<TMethod, TArgs> & {
	key: MetadataKey;
	reflect(target: object): ScopedReflector<TMeta>;
	metadata(target: object, name: string | symbol): TMeta | undefined;
	requireMetadata(target: object, name: string | symbol): TMeta;
	applied(target: object, name: string | symbol): boolean;
	appliedOwn(target: object, name: string | symbol): boolean;
};

export type DecoratedPropertyFactory<TMeta, TArgs extends unknown[] = [TMeta], TField = unknown> = FieldDecoratorFn<
	TField,
	TArgs
> & {
	key: MetadataKey;
	reflect(target: object): ScopedReflector<TMeta>;
	metadata(target: object, name: string | symbol): TMeta | undefined;
	requireMetadata(target: object, name: string | symbol): TMeta;
	applied(target: object, name: string | symbol): boolean;
	appliedOwn(target: object, name: string | symbol): boolean;
};

export type DecoratedAccessorFactory<TMeta, TArgs extends unknown[] = [TMeta], TValue = unknown> = AccessorDecoratorFn<
	TValue,
	TArgs
> & {
	key: MetadataKey;
	reflect(target: object): ScopedReflector<TMeta>;
	metadata(target: object, name: string | symbol): TMeta | undefined;
	requireMetadata(target: object, name: string | symbol): TMeta;
	applied(target: object, name: string | symbol): boolean;
	appliedOwn(target: object, name: string | symbol): boolean;
};
