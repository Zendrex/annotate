/** biome-ignore-all lint/performance/noBarrelFile: main index file */

/**
 * Public API for **@zendrex/annotate**: the primary barrel for this package. It
 * exposes two frozen registries of decorator and interceptor factories, re-exports
 * domain errors from the metadata layer, `reflect` and `prepare` for reading and
 * bootstrapping metadata, and the TypeScript types that shape options, validators,
 * and the reflector API. Use the factory registries as the supported entry when
 * building on this library; they keep the public surface small and version-stable.
 */
export {
	AnnotateError,
	AnnotateErrorCode,
	DuplicateMetadataError,
	InvalidDecorationTargetError,
	MissingMetadataError,
	UnregisteredClassError,
	UnregisteredMetadataKeyError,
	ValidationError,
} from "./errors";

import { createAccessorInterceptor } from "./factories/accessor-interceptor";
import { createClassDecorator } from "./factories/class-decorator";
import { createMethodDecorator } from "./factories/method-decorator";
import { createMethodInterceptor } from "./factories/method-interceptor";
import { createPropertyDecorator } from "./factories/property-decorator";

/**
 * Version-stable registry of decorator factories (class, method, property). Prefer
 * this object over deep imports from `./factories/*` in consuming code.
 */
export const decorate = Object.freeze({
	class: createClassDecorator,
	method: createMethodDecorator,
	property: createPropertyDecorator,
} as const);

/**
 * Version-stable registry of method and accessor interceptor factories. Prefer this
 * object over deep imports from `./factories/*` in consuming code.
 */
export const intercept = Object.freeze({
	method: createMethodInterceptor,
	accessor: createAccessorInterceptor,
} as const);

export { getKeyCardinality, mintListKey, mintUniqueKey } from "./metadata/cardinality-registry";
export { reflect } from "./reflector/reflector";
export { prepare } from "./runtime/prepare";
export type {
	AccessorInterceptorOptions,
	AnyFn,
	ArgsOf,
	DecoratedAccessorFactory,
	DecoratedClassFactory,
	DecoratedMethodFactory,
	DecoratedPropertyFactory,
	DecoratorOptions,
	DeriveOptions,
	InterceptorContext,
	MetadataOf,
	MethodInterceptorOptions,
	ThisOf,
	ValidateContext,
	ValidatorFn,
} from "./factories/types";
export type { ListMetadataKey, MetadataArray, MetadataKey, UniqueMetadataKey } from "./metadata/types";
export type { Reflector } from "./reflector/reflector";
export type {
	DecoratedClass,
	DecoratedItem,
	DecoratedKind,
	DecoratedMethod,
	DecoratedMethodScalar,
	DecoratedProperty,
	DecoratedPropertyScalar,
	ScopedReflector,
} from "./reflector/types";
