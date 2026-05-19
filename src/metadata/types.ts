// biome-ignore lint/complexity/noBannedTypes: WeakMap key parity requires bare Function across the store and related modules.
export type Ctor = Function;

export type Cardinality = "unique" | "list";

export type MetadataKey<TValue = unknown, TCard extends Cardinality = Cardinality> = symbol & {
	readonly __metadataKey: { value: TValue; cardinality: TCard };
};

export type UniqueMetadataKey<T> = MetadataKey<T, "unique">;

export type ListMetadataKey<T> = MetadataKey<T, "list">;

export type ClassBucket = Map<symbol, unknown[]>;

export interface MemberEntry {
	readonly kind: MemberKind;
	readonly static: boolean;
	values: unknown[];
}

export type MemberBucket = Map<symbol, Map<string | symbol, MemberEntry>>;

export type MemberKind = "method" | "property" | "field" | "accessor";

export type MetadataArray<T = unknown> = readonly T[];

export interface Deferred {
	key: MetadataKey;
	kind: MemberKind;
	meta: unknown;
	name: string | symbol;
	static: boolean;
	token: symbol;
	validators?: readonly DeferredValidatorFn[];
}

export type DeferredValidatorFn = (meta: unknown, context: DeferredValidateContext) => void;

export interface DeferredValidateContext {
	kind: MemberKind;
	memberName?: string | symbol;
	static: boolean;
	target: Ctor;
}
