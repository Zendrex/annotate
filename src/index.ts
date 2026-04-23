/**
 * @packageDocumentation
 *
 * A TypeScript decorator factory library with metadata storage and reflection
 * capabilities, built on TC39 Stage-3 decorators.
 */
/** biome-ignore-all lint/performance/noBarrelFile: main index file */

export { AnnotateError, AnnotateErrorCode, DuplicateMetadataError, UnregisteredClassError } from "./errors";
export { createAccessorInterceptor } from "./factories/accessor-interceptor";
export { createClassDecorator } from "./factories/class-decorator";
export { createMethodDecorator } from "./factories/method-decorator";
export { createMethodInterceptor } from "./factories/method-interceptor";
export { createPropertyDecorator } from "./factories/property-decorator";
export { reflect } from "./reflector/reflector";
export { materialize } from "./runtime/materialize";
export type {
	AccessorInterceptorOptions,
	AnyFn,
	DecoratedAccessorFactory,
	DecoratedClassFactory,
	DecoratedMethodFactory,
	DecoratedPropertyFactory,
	DecoratorOptions,
	InterceptorContext,
	MethodInterceptorOptions,
} from "./factories/types";
export type { MetadataArray, MetadataKey } from "./metadata/types";
export type { Reflector } from "./reflector/reflector";
export type {
	DecoratedClass,
	DecoratedItem,
	DecoratedKind,
	DecoratedMethod,
	DecoratedMethodSingle,
	DecoratedProperty,
	DecoratedPropertySingle,
	ScopedReflector,
} from "./reflector/types";
