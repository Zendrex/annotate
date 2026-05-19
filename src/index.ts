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
export { prepare } from "./metadata/pipeline";
export { reflect } from "./reflector/reflector";
export { createScopedReflector } from "./reflector/scoped-reflector";
export type {
	AccessorAnnotation,
	AccessorInterceptorOptions as AnnotateAccessorInterceptorOptions,
	AnnotationArgsOptions,
	AnnotationOptions,
	Cardinality,
	ClassAnnotation,
	ClassAnnotationEntry,
	FieldAnnotation,
	FieldInterceptorOptions as AnnotateFieldInterceptorOptions,
	IClassAnnotationReader,
	IMemberAnnotationReader,
	MemberAnnotationEntry,
	MethodAnnotation,
	MethodInterceptorOptions as AnnotateMethodInterceptorOptions,
	PublicInterceptorContext,
	ValidateContext,
} from "./annotate";
export type { ListMetadataKey, MetadataKey, UniqueMetadataKey } from "./metadata/types";
export type { IReflector } from "./reflector/reflector";
export type {
	DecoratedClassList,
	DecoratedClassUnique,
	DecoratedItem,
	DecoratedKind,
	DecoratedMethodList,
	DecoratedMethodUnique,
	DecoratedPropertyList,
	DecoratedPropertyUnique,
	IScopedReflector,
} from "./reflector/types";
