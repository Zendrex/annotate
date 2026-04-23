/**
 * @packageDocumentation
 *
 * A TypeScript decorator factory library with metadata storage and reflection capabilities.
 */
/** biome-ignore-all lint/performance/noBarrelFile: main index file */
import "reflect-metadata";

export { AnnotateError, AnnotateErrorCode } from "./errors";
export { createClassDecorator } from "./factories/class-decorator";
export { createMethodDecorator } from "./factories/method-decorator";
export { createMethodInterceptor } from "./factories/method-interceptor";
export { createParameterDecorator } from "./factories/parameter-decorator";
export { createPropertyDecorator } from "./factories/property-decorator";
export { createPropertyInterceptor } from "./factories/property-interceptor";
export {
	appendMetadata,
	defineMetadata,
	getMetadata,
	getMetadataArray,
	getOwnMetadata,
	getParameterMap,
	setParameterMap,
} from "./metadata/store";
export { reflect } from "./reflector/reflector";
export type {
	DecoratedClassFactory,
	DecoratedMethodFactory,
	DecoratedParameterFactory,
	DecoratedPropertyFactory,
	DecoratorOptions,
	InterceptorContext,
	MethodInterceptorOptions,
	ParameterDecoratorOptions,
	PropertyGetter,
	PropertyInterceptorOptions,
	PropertySetter,
} from "./factories/types";
export type { MetadataArray, MetadataKey, ParameterMetadataMap } from "./metadata/types";
export type { Reflector } from "./reflector/reflector";
export type {
	DecoratedClass,
	DecoratedConstructorParameter,
	DecoratedItem,
	DecoratedKind,
	DecoratedMethod,
	DecoratedMethodParameter,
	DecoratedMethodSingle,
	DecoratedParameter,
	DecoratedProperty,
	DecoratedPropertySingle,
	ScopedReflector,
} from "./reflector/types";
