/** Bare `Function` to match `WeakMap` keys and reflection usage. */
// biome-ignore lint/complexity/noBannedTypes: WeakMap key parity requires bare Function across the store and related modules.
export type Ctor = Function;

/** `"unique"`: at most one value per site. `"list"`: append-only ordered list. */
export type Cardinality = "unique" | "list";

/** Branded so bare `symbol` is not assignable; `__metadataKey` is compile-time only. */
export type MetadataKey<TValue = unknown, TCard extends Cardinality = Cardinality> = symbol & {
	readonly __metadataKey: { value: TValue; cardinality: TCard };
};

export type UniqueMetadataKey<T> = MetadataKey<T, "unique">;

export type ListMetadataKey<T> = MetadataKey<T, "list">;

/** Per-class class-only metadata: each key maps to an append-only value list. */
export type ClassBucket = Map<symbol, unknown[]>;

/**
 * One member's own values under a key. `static` and `kind` are fixed at first
 * append; later appends do not change them.
 */
export interface MemberEntry {
	readonly kind: MemberKind;
	readonly static: boolean;
	values: unknown[];
}

/** Per-class member metadata: key → member name → entry. */
export type MemberBucket = Map<symbol, Map<string | symbol, MemberEntry>>;

export type MemberKind = "method" | "property" | "field" | "accessor";

/** Member metadata held until ctor correlation supplies the real `Ctor`. */
export interface Deferred {
	key: MetadataKey;
	kind: MemberKind;
	meta: unknown;
	name: string | symbol;
	static: boolean;
	/** Skips re-apply after a failed partial flush. */
	token: symbol;
	validators?: readonly DeferredValidatorFn[];
}

/** Runs on deferred flush with the resolved constructor and pending value. */
export type DeferredValidatorFn = (meta: unknown, context: DeferredValidateContext) => void;

/** What validators see when flushing, without re-reading the store. */
export interface DeferredValidateContext {
	kind: MemberKind;
	memberName?: string | symbol;
	static: boolean;
	target: Ctor;
}

/** Read-only view of stored values; append order preserved for list keys. */
export type MetadataArray<T = unknown> = readonly T[];
