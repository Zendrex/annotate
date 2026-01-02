/** biome-ignore-all lint/performance/noBarrelFile: barrel file */
import "reflect-metadata";

export type {
	ClassDecoratorFactory,
	ClassDecoratorReflection,
	DecoratedClass,
	DecoratedClassFactory,
	DecoratedItem,
	DecoratedKind,
	DecoratedMethod,
	DecoratedMethodFactory,
	DecoratedParameter,
	DecoratedParameterFactory,
	DecoratedProperty,
	DecoratedPropertyFactory,
	InterceptorContext,
	MetadataArray,
	MetadataKey,
	MethodDecoratorFactory,
	MethodDecoratorReflection,
	MethodInterceptorOptions,
	ParameterDecoratorFactory,
	ParameterDecoratorReflection,
	ParameterMetadataMap,
	PropertyDecoratorFactory,
	PropertyDecoratorReflection,
	PropertyGetter,
	PropertyInterceptorOptions,
	PropertySetter,
	ScopedReflector,
} from "./lib/types";

export {
	createClassDecorator,
	createMethodDecorator,
	createMethodInterceptor,
	createParameterDecorator,
	createPropertyDecorator,
	createPropertyInterceptor,
} from "./lib/factories";
export {
	appendMetadata,
	defineMetadata,
	getMetadata,
	getMetadataArray,
	getOwnMetadata,
	getParameterMap,
	setParameterMap,
} from "./lib/metadata";
export { createScopedReflector, Reflector, reflect } from "./lib/reflector";
