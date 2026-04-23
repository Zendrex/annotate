import type { MetadataKey } from "./metadata/types";
import type { AnyConstructor, DecoratedKind } from "./reflector/types";

/**
 * Discriminator values for {@link AnnotateError.code}.
 *
 * - `DUPLICATE` — thrown at decoration time when `unique` is violated.
 * - `MISSING` — thrown at reflection time by `requireMetadata` when the
 *   requested slot has no recorded metadata.
 */
export const AnnotateErrorCode = {
	DUPLICATE: "duplicate",
	MISSING: "missing",
} as const;
export type AnnotateErrorCode = (typeof AnnotateErrorCode)[keyof typeof AnnotateErrorCode];

/** @internal */
export interface AnnotateErrorOptions {
	code: AnnotateErrorCode;
	key: MetadataKey;
	kind: DecoratedKind;
	memberName?: string | symbol;
	message: string;
	parameterIndex?: number;
	target: AnyConstructor;
}

/**
 * Thrown by decorator factories when a library invariant is violated.
 *
 * Two failure modes share this type, discriminated by `code`:
 *
 * - Decoration-time `"duplicate"` — a factory with `unique: true` was applied
 *   to a site that already has metadata.
 * - Reflection-time `"missing"` — `factory.requireMetadata(...)` was called on
 *   a site without recorded metadata.
 *
 * Always thrown with `target` resolved to a class constructor (never an
 * instance or prototype). `memberName` and `parameterIndex` are populated only
 * when they apply to the kind. Distinguish from consumer domain errors with
 * `instanceof AnnotateError`.
 */
export class AnnotateError extends Error {
	override readonly name: string = "AnnotateError";

	/** Factory-level metadata key identifying which decorator raised the error. */
	readonly key: MetadataKey;
	/** Decoration site kind where the violation occurred. */
	readonly kind: DecoratedKind;
	readonly code: AnnotateErrorCode;
	readonly target: AnyConstructor;
	/** Set for method/property/method-parameter sites. */
	readonly memberName?: string | symbol;
	/** Set for constructor-parameter and method-parameter sites. */
	readonly parameterIndex?: number;

	constructor(options: AnnotateErrorOptions) {
		super(options.message);
		this.key = options.key;
		this.kind = options.kind;
		this.code = options.code;
		this.target = options.target;
		this.memberName = options.memberName;
		this.parameterIndex = options.parameterIndex;
	}
}
