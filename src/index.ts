/** biome-ignore-all lint/performance/noBarrelFile: main index file */

/**
 * Public API barrel for `@zendrex/annotate`: errors, `reflect`, `prepare`, key
 * helpers, and shared types. Prefer the frozen `decorate` and `intercept`
 * registries over deep imports — same factories, version-stable surface.
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
import { createFieldInterceptor, createFieldListInterceptor } from "./factories/field-interceptor";
import { createMethodDecorator, createMethodListDecorator } from "./factories/method-decorator";
import { createMethodInterceptor, createMethodListInterceptor } from "./factories/method-interceptor";
import { createPropertyDecorator, createPropertyListDecorator } from "./factories/property-decorator";

const withList = <U extends object, L>(unique: U, list: L): U & { list: L } => Object.assign(unique, { list });

/**
 * Frozen registry of decorator factories. Each `class`, `method`, and
 * `property` entry exposes the unique-cardinality factory directly and a
 * `.list` sibling for list-cardinality metadata. Prefer this over deep
 * imports.
 */
export const decorate = Object.freeze({
	class: withList(createClassDecorator, createClassListDecorator),
	method: withList(createMethodDecorator, createMethodListDecorator),
	property: withList(createPropertyDecorator, createPropertyListDecorator),
} as const);

/**
 * Frozen registry of interceptor factories. `method`, `accessor`, and `field`
 * each expose the unique-cardinality factory and a `.list` sibling for
 * list-cardinality metadata. Prefer this over deep imports.
 *
 * `field` performs value replacement from an `addInitializer` body rather than
 * returning a replacement initializer closure, so it is safe under Bun 1.3's
 * Stage-3 transformer (which shares such closures across classes in the same
 * module).
 */
export const intercept = Object.freeze({
	method: withList(createMethodInterceptor, createMethodListInterceptor),
	accessor: withList(createAccessorInterceptor, createAccessorListInterceptor),
	field: withList(createFieldInterceptor, createFieldListInterceptor),
} as const);

export { mintListKey, mintUniqueKey } from "./metadata/cardinality-registry";
export { reflect } from "./reflector/reflector";
export { prepare } from "./runtime/prepare";
export type {
	AccessorInterceptorOptions,
	AnyFn,
	ArgsOf,
	CardinalityOf,
	DecoratedAccessorFactory,
	DecoratedClassFactory,
	DecoratedMethodFactory,
	DecoratedPropertyFactory,
	DecoratorOptions,
	DeriveOptions,
	FieldInterceptorOptions,
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
