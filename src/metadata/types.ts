/** Per-factory metadata key. Each factory generates a unique symbol at construction. */
export type MetadataKey = symbol;

/** Bucket of class-scoped metadata, keyed per factory symbol. */
export type ClassBucket = Map<symbol, unknown[]>;

/**
 * Bucket of member-scoped metadata.
 *
 * Outer key: per-factory symbol (`MetadataKey`).
 * Inner key: member name (`string | symbol`).
 *
 * `Map` is used at both nesting levels to avoid prototype-pollution hazards
 * present with plain object records.
 */
export type MemberBucket = Map<symbol, Map<string | symbol, unknown[]>>;

/**
 * Pending instance-member registration captured at decoration time and
 * committed when the declaring class is correlated (eager flush via
 * `flushFor`, or lazy commit via the per-instance initializer).
 *
 * @internal
 */
export interface Deferred {
	key: symbol;
	meta: unknown;
	name: string | symbol;
	token: symbol;
	unique: boolean;
}

// Thin alias retained for downstream compatibility. Phase C+ consumers migrate to ClassBucket / MemberBucket.
export type MetadataArray<T = unknown> = readonly T[];
