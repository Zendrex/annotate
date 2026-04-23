import type { MetadataKey } from "./metadata/types";
import type { AnyConstructor, DecoratedKind } from "./reflector/types";

/** Error codes for {@link AnnotateError}. */
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
 * Thrown by decorator factories on invariant violation.
 *
 * Decoration time: uniqueness violations (`code: "duplicate"`).
 * Reflection time: required metadata absent (`code: "missing"`).
 * Distinguish from domain errors via `instanceof`.
 */
export class AnnotateError extends Error {
	override readonly name: string = "AnnotateError";

	readonly key: MetadataKey;
	readonly kind: DecoratedKind;
	readonly code: AnnotateErrorCode;
	readonly target: AnyConstructor;
	readonly memberName?: string | symbol;
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
