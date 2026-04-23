/**
 * @packageDocumentation
 *
 * A TypeScript decorator factory library with metadata storage and reflection capabilities.
 */
/** biome-ignore-all lint/performance/noBarrelFile: main index file */
import "reflect-metadata";

export { AnnotateError, AnnotateErrorCode, UnregisteredClassError } from "./errors";
export { createClassDecorator } from "./factories/class-decorator";
export { createMethodDecorator } from "./factories/method-decorator";
export { createMethodInterceptor } from "./factories/method-interceptor";
export { createParameterDecorator } from "./factories/parameter-decorator";
export { createPropertyDecorator } from "./factories/property-decorator";
export { createPropertyInterceptor } from "./factories/property-interceptor";
export { reflect } from "./reflector/reflector";
export { materialize } from "./runtime/materialize";
export type {
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
