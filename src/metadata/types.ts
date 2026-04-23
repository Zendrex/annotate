/** Unique symbol key used to identify and store decorator metadata. */
export type MetadataKey = symbol;

/**
 * Array preserving decorator application order when multiple decorators of same type
 * are applied to a target.
 *
 * @typeParam T - Metadata type stored by decorator
 */
export type MetadataArray<T> = T[];

/**
 * Maps zero-based parameter indexes to metadata arrays.
 *
 * @typeParam T - Metadata type stored per parameter
 */
export type ParameterMetadataMap<T> = Map<number, MetadataArray<T>>;
