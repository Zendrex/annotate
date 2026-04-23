/**
 * Internal constructor identity used as the key across metadata WeakMaps.
 *
 * Typed as bare `Function` (not `AnyConstructor`) because WeakMap keys accept
 * any callable — including the raw forms received by the decorator bodies
 * before the reflector coerces them to constructors. Kept internal; public
 * API surfaces use `AnyConstructor` from `reflector/types`.
 *
 * @internal
 */
// biome-ignore lint/complexity/noBannedTypes: WeakMap key parity requires bare Function across the store and related modules.
export type Ctor = Function;

/** Per-factory metadata key. Each factory generates a unique symbol at construction. */
export type MetadataKey = symbol;

export type ClassBucket = Map<symbol, unknown[]>;

/**
 * Member-scoped metadata. Outer key is the factory's {@link MetadataKey};
 * inner key is the member name. `Map` is used at both levels to avoid
 * prototype-pollution hazards of plain object records.
 */
export type MemberBucket = Map<symbol, Map<string | symbol, unknown[]>>;

export type MemberKind = "method" | "property";

/**
 * Pending instance-member registration captured at decoration time. Committed
 * once the declaring class is correlated — eagerly via `flushFor`, or lazily
 * via the per-instance initializer on first construction.
 *
 * @internal
 */
export interface Deferred {
	key: symbol;
	kind: MemberKind;
	meta: unknown;
	name: string | symbol;
	static: boolean;
	token: symbol;
	unique: boolean;
}

export type MetadataArray<T = unknown> = readonly T[];
