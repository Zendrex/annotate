import type { MetadataKey } from "../metadata/types";
import type { ScopedReflector } from "../reflector/types";

/** Function signature for property getters in interceptor decorators. */
export type PropertyGetter = (this: unknown) => unknown;

/** Function signature for property setters in interceptor decorators. */
export type PropertySetter = (this: unknown, value: unknown) => void;

/**
 * Context passed to interceptor callbacks.
 */
export interface InterceptorContext {
	descriptor: PropertyDescriptor;
	name: string | symbol;
	owner: object;
}

/**
 * One shape for class, method, property and interceptors. `unique` semantics
 * differ by kind (factory JSDoc).
 */
export interface DecoratorOptions<TMeta, TArgs extends unknown[] = [TMeta]> {
	compose?: (...args: TArgs) => TMeta;
	name?: string;
	unique?: boolean;
}

export type ParameterDecoratorOptions<TMeta, TArgs extends unknown[] = [TMeta]> = Omit<
	DecoratorOptions<TMeta, TArgs>,
	"unique"
>;

export interface MethodInterceptorOptions<TMeta, TArgs extends unknown[] = [TMeta]>
	extends DecoratorOptions<TMeta, TArgs> {
	intercept: (
		original: (...args: unknown[]) => unknown,
		metadata: TMeta[],
		context: InterceptorContext
	) => (...args: unknown[]) => unknown;
}

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

export type DecoratedClassFactory<TMeta, TArgs extends unknown[] = [TMeta]> = ClassDecoratorFactory<TMeta, TArgs> & {
	key: MetadataKey;
	reflect(target: object): ScopedReflector<TMeta>;
	metadata(target: object): TMeta | undefined;
	requireMetadata(target: object): TMeta;
	applied(target: object): boolean;
	appliedOwn(target: object): boolean;
};

// --- Method / property factory surface ---

export type DecoratedMethodFactory<TMeta, TArgs extends unknown[] = [TMeta]> = MethodDecoratorFactory<TMeta, TArgs> & {
	key: MetadataKey;
	reflect(target: object): ScopedReflector<TMeta>;
	metadata(target: object, name: string | symbol): TMeta | undefined;
	requireMetadata(target: object, name: string | symbol): TMeta;
	applied(target: object, name: string | symbol): boolean;
	appliedOwn(target: object, name: string | symbol): boolean;
};

export type DecoratedPropertyFactory<TMeta, TArgs extends unknown[] = [TMeta]> = PropertyDecoratorFactory<
	TMeta,
	TArgs
> & {
	key: MetadataKey;
	reflect(target: object): ScopedReflector<TMeta>;
	metadata(target: object, name: string | symbol): TMeta | undefined;
	requireMetadata(target: object, name: string | symbol): TMeta;
	applied(target: object, name: string | symbol): boolean;
	appliedOwn(target: object, name: string | symbol): boolean;
};

// --- Parameter factory surface ---

export type DecoratedParameterFactory<TMeta, TArgs extends unknown[] = [TMeta]> = ParameterDecoratorFactory<
	TMeta,
	TArgs
> & {
	key: MetadataKey;
	reflect(target: object): ScopedReflector<TMeta>;
	metadata(target: object, parameterIndex: number, methodName?: string | symbol): TMeta | undefined;
	requireMetadata(target: object, parameterIndex: number, methodName?: string | symbol): TMeta;
	applied(target: object, parameterIndex: number, methodName?: string | symbol): boolean;
	appliedOwn(target: object, parameterIndex: number, methodName?: string | symbol): boolean;
};
