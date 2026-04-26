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

const withList = <U extends object, L>(unique: U, list: L): U & { list: L } => Object.assign(unique, { list });

/**
 * Version-stable registry of decorator factories (class, method, property). Each
 * member is callable as the unique factory and exposes a `.list` sibling for
 * list-cardinality metadata. Prefer this object over deep imports.
 *
 * - `decorate.class(opts)` / `decorate.class.list(opts)` — class decorator factories
 * - `decorate.method(opts)` / `decorate.method.list(opts)` — method decorator factories
 * - `decorate.property(opts)` / `decorate.property.list(opts)` — property decorator factories
 */
export const decorate = Object.freeze({
	class: withList(createClassDecorator, createClassListDecorator),
	method: withList(createMethodDecorator, createMethodListDecorator),
	property: withList(createPropertyDecorator, createPropertyListDecorator),
} as const);

/**
 * Version-stable registry of method and accessor interceptor factories. Each
 * member exposes a `.list` sibling for list-cardinality metadata. Prefer this
 * object over deep imports.
 *
 * - `intercept.method(opts)` / `intercept.method.list(opts)` — method interceptor factories
 * - `intercept.accessor(opts)` / `intercept.accessor.list(opts)` — accessor interceptor factories
 */
export const intercept = Object.freeze({
	method: withList(createMethodInterceptor, createMethodListInterceptor),
	accessor: withList(createAccessorInterceptor, createAccessorListInterceptor),
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
	DecoratedClassList,
	DecoratedClassUnique,
	DecoratedItem,
	DecoratedKind,
	DecoratedMethodList,
	DecoratedMethodUnique,
	DecoratedPropertyList,
	DecoratedPropertyUnique,
	ScopedReflector,
} from "./reflector/types";
