/** biome-ignore-all lint/performance/noBarrelFile: main index file */

export { Annotate } from "./annotate";
/**
 * Public API barrel for `@zendrex/annotate`: the `Annotate` namespace, errors,
 * `reflect`, `prepare`, key helpers, and shared types.
 */
export {
	AnnotateError,
	AnnotateErrorCode,
	DuplicateMetadataError,
	InvalidDecorationTargetError,
	InvalidSelectorError,
	MissingMetadataError,
	UnregisteredClassError,
	UnregisteredMetadataKeyError,
	ValidationError,
} from "./errors";
export { mintListKey, mintUniqueKey } from "./metadata/cardinality-registry";
export { reflect } from "./reflector/reflector";
export { prepare } from "./runtime/prepare";
export type {
	AccessorAnnotation,
	AccessorInterceptorOptions as AnnotateAccessorInterceptorOptions,
	AnnotationArgsOptions,
	AnnotationOptions,
	Cardinality,
	ClassAnnotation,
	ClassAnnotationEntry,
	ClassAnnotationReader,
	FieldAnnotation,
	FieldInterceptorOptions as AnnotateFieldInterceptorOptions,
	MemberAnnotationEntry,
	MemberAnnotationReader,
	MethodAnnotation,
	MethodInterceptorOptions as AnnotateMethodInterceptorOptions,
	PublicInterceptorContext,
} from "./annotate";
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
