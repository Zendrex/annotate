/**
 * Class constructor as stored in metadata maps. Uses `Function` so the same
 * key type lines up with `WeakMap` usage and reflection across the package.
 */
// biome-ignore lint/complexity/noBannedTypes: WeakMap key parity requires bare Function across the store and related modules.
export type Ctor = Function;

/**
 * Branded symbol for a metadata "channel" that carries cardinality at the type level.
 *
 * The phantom field `__metadataKey` is never present at runtime — it exists solely to
 * prevent bare `symbol` from being assignable to a `MetadataKey<T, C>`. A branded key
 * IS a `symbol`, so it flows into any API that accepts a raw `symbol`.
 *
 * Default params preserve existing `MetadataKey` usage sites (no-arg imports remain valid).
 *
 * @typeParam TValue - The value type stored under this key.
 * @typeParam TCard - Cardinality discriminant: `"unique"` (at most one value) or `"list"`.
 */
export type MetadataKey<TValue = unknown, TCard extends "unique" | "list" = "unique" | "list"> = symbol & {
	readonly __metadataKey: { value: TValue; cardinality: TCard };
};

/** Shorthand for a key that allows exactly one metadata value per site. */
export type UniqueMetadataKey<T> = MetadataKey<T, "unique">;

/** Shorthand for a key that accumulates a list of metadata values per site. */
export type ListMetadataKey<T> = MetadataKey<T, "list">;

/**
 * Per-class own metadata: each key holds an append-only list of values for that class only.
 */
export type ClassBucket = Map<symbol, unknown[]>;

/**
 * Per-class own member metadata: key → member name → list of values for that member only.
 */
export type MemberBucket = Map<symbol, Map<string | symbol, unknown[]>>;

/**
 * Whether metadata was attached to a class method or a property.
 */
export type MemberKind = "method" | "property";

/**
 * Member metadata that could not be written immediately because the target class
 * was not the runtime constructor yet. The deferred queue flushes this into
 * the member store once ctor correlation and the real `Ctor` are known.
 */
export interface Deferred {
	/** Metadata channel (same as keys used in `appendMemberMeta`). */
	key: symbol;
	kind: MemberKind;
	meta: unknown;
	name: string | symbol;
	static: boolean;
	/**
	 * Idempotency token: `appendMemberMeta` skips re-applying the same
	 * deferred item after a failed partial flush.
	 */
	token: symbol;
	/** When true, only one value is allowed for this member+key; enforced on flush. */
	unique: boolean;
	/** Optional checks run on flush before the value is stored. */
	validators?: readonly DeferredValidatorFn[];
}

/**
 * Called during a deferred flush with the final constructor and the pending meta value.
 */
export type DeferredValidatorFn = (meta: unknown, context: DeferredValidateContext) => void;

/**
 * Context passed to deferred validators: enough to reason about the member without re-reading the store.
 */
export interface DeferredValidateContext {
	kind: MemberKind;
	memberName?: string | symbol;
	static: boolean;
	/** The resolved class constructor for this metadata. */
	target: Ctor;
}

/**
 * Read-only list of stored metadata values (append order preserved where relevant).
 */
export type MetadataArray<T = unknown> = readonly T[];
