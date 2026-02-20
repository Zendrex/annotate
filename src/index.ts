/**
 * @packageDocumentation
 *
 * A TypeScript decorator factory library with metadata storage and reflection capabilities.
 *
 * This package provides:
 * - **Decorator Factories**: {@link createClassDecorator}, {@link createMethodDecorator},
 *   {@link createPropertyDecorator}, {@link createParameterDecorator} - Create type-safe
 *   decorators that automatically store metadata for later reflection.
 * - **Interceptors**: {@link createMethodInterceptor}, {@link createPropertyInterceptor} -
 *   Create decorators that wrap method calls or property access for cross-cutting concerns.
 * - **Metadata Utilities**: {@link getMetadata}, {@link defineMetadata}, {@link appendMetadata} -
 *   Low-level functions for reading and writing metadata on targets.
 * - **Reflection**: {@link Reflector}, {@link reflect}, {@link createScopedReflector} -
 *   Retrieve stored metadata from decorated classes and their members.
 */

/** biome-ignore-all lint/performance/noBarrelFile: main index file */
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
