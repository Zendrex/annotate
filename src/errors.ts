import { targetDisplayName } from "./reflector/class-name";
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
 * instance or prototype). `memberName` is populated only when the kind is
 * `"method"` or `"property"`. Distinguish from consumer domain errors with
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
	/** Set for method/property sites. */
	readonly memberName?: string | symbol;

	constructor(options: AnnotateErrorOptions) {
		super(options.message);
		this.key = options.key;
		this.kind = options.kind;
		this.code = options.code;
		this.target = options.target;
		this.memberName = options.memberName;
	}
}

/**
 * Thrown when a decorator factory with `unique: true` is applied to a site
 * that already has metadata for the same key.
 *
 * @throws {DuplicateMetadataError} At decoration time, before any state mutation.
 */
export class DuplicateMetadataError extends AnnotateError {
	override readonly name: string = "DuplicateMetadataError";

	constructor(ctor: AnyConstructor, key: MetadataKey, kind: DecoratedKind, memberName?: string | symbol) {
		const slot = memberName
			? `"${String(memberName)}" on "${targetDisplayName(ctor)}"`
			: `"${targetDisplayName(ctor)}"`;
		super({
			code: AnnotateErrorCode.DUPLICATE,
			key,
			kind,
			target: ctor,
			memberName,
			message: `duplicate decoration: ${slot} already has metadata for this factory`,
		});
	}
}

/**
 * Thrown by reflector collection methods when a class has no registered
 * annotate metadata (after auto-materialization). Distinguished from "no
 * metadata for this factory" — that condition returns an empty collection.
 *
 * Common causes: the class was authored under `experimentalDecorators: true`,
 * `reflect-metadata` is still imported, the bundler dropped the decoration
 * module, or a class decorator was expected but never applied. Call
 * `materialize(ctor)` on instance-member-only classes if pre-instantiation
 * reflection is required and the class has no class decorator or static decorations.
 */
export class UnregisteredClassError extends Error {
	override readonly name: string = "UnregisteredClassError";

	readonly target: AnyConstructor;

	constructor(target: AnyConstructor) {
		super(
			`@zendrex/annotate: no registered metadata for "${targetDisplayName(target)}". ` +
				"Causes: missing decorator import, bundler tree-shake of the decoration module, " +
				`legacy "experimentalDecorators: true" emit, or instance-member-only class with ` +
				"no class decorator (call materialize(ctor) before reflect)."
		);
		this.target = target;
	}
}
