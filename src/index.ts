/** biome-ignore-all lint/performance/noBarrelFile: main index file */

export { Annotate } from "./annotate";
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
export { mintListKey, mintUniqueKey } from "./metadata/cardinality";
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
	ValidateContext,
} from "./annotate";
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
