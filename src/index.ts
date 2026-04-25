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

import { createAccessorInterceptor, createAccessorListInterceptor } from "./factories/accessor-interceptor";
import { createClassDecorator, createClassListDecorator } from "./factories/class-decorator";
import { createMethodDecorator, createMethodListDecorator } from "./factories/method-decorator";
import { createMethodInterceptor, createMethodListInterceptor } from "./factories/method-interceptor";
import { createPropertyDecorator, createPropertyListDecorator } from "./factories/property-decorator";

/**
 * Version-stable registry of decorator factories (class, method, property). Each
 * member is callable as the unique factory and exposes a `.list` sibling for
 * list-cardinality metadata. Prefer this object over deep imports.
 *
 * - `decorate.class(opts)` — unique-cardinality class decorator factory
 * - `decorate.class.list(opts)` — list-cardinality class decorator factory
 */
export const decorate = Object.freeze({
	class: Object.assign(createClassDecorator, { list: createClassListDecorator }),
	method: Object.assign(createMethodDecorator, { list: createMethodListDecorator }),
	property: Object.assign(createPropertyDecorator, { list: createPropertyListDecorator }),
} as const);

/**
 * Version-stable registry of method and accessor interceptor factories. Each
 * member exposes a `.list` sibling for list-cardinality metadata. Prefer this
 * object over deep imports.
 *
 * - `intercept.method(opts)` — unique-cardinality method interceptor factory
 * - `intercept.method.list(opts)` — list-cardinality method interceptor factory
 */
export const intercept = Object.freeze({
	method: Object.assign(createMethodInterceptor, { list: createMethodListInterceptor }),
	accessor: Object.assign(createAccessorInterceptor, { list: createAccessorListInterceptor }),
} as const);

export { mintListKey, mintUniqueKey } from "./metadata/cardinality-registry";
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
