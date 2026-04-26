import { targetDisplayName } from "./reflector/class-name";
import type { Cardinality, MetadataKey } from "./metadata/types";
import type { AnyConstructor, DecoratedKind } from "./reflector/types";

/**
 * Domain codes for {@link AnnotateError#code}. Use these instead of matching
 * message strings. Each value maps to a dedicated subclass of
 * {@link AnnotateError} in this module.
 */
export const AnnotateErrorCode = {
	DUPLICATE: "duplicate",
	MISSING: "missing",
	UNREGISTERED: "unregistered",
	UNREGISTERED_KEY: "unregisteredKey",
	INVALID_TARGET: "invalidTarget",
	VALIDATION: "validation",
} as const;

/** Discriminant string for {@link AnnotateError#code} (see {@link AnnotateErrorCode}). */
export type AnnotateErrorCode = (typeof AnnotateErrorCode)[keyof typeof AnnotateErrorCode];

/**
 * Human-readable display string for a metadata key: prefers `description`, falls
 * back to `String(key)` (e.g. `"Symbol()"`) when the description is missing.
 */
export function keyDisplayName(key: MetadataKey): string {
	return key.description ?? String(key);
}

/**
 * Arguments for {@link AnnotateError}. Optional fields add reflection context
 * (key, kind, member) for diagnostics; omit when not applicable.
 */
export interface AnnotateErrorOptions {
	cause?: unknown;
	code: AnnotateErrorCode;
	key?: MetadataKey;
	kind?: DecoratedKind;
	memberName?: string | symbol;
	message: string;
	target: AnyConstructor;
}

/**
 * Base error for the library. Check {@link AnnotateError#code} or `instanceof`
 * a concrete error class; message strings are for humans only.
 */
export class AnnotateError extends Error {
	override readonly name: string = "AnnotateError";

	/** Subclass-specific value from {@link AnnotateErrorCode} for programmatic handling. */
	readonly code: AnnotateErrorCode;
	/** Class constructor the operation referred to. */
	readonly target: AnyConstructor;

	/** Factory metadata key, when the failure relates to a specific entry. */
	readonly key?: MetadataKey;

	/** What was decorated (class, method, field, etc.), when known. */
	readonly kind?: DecoratedKind;

	/** Property or method name for member-level issues; absent for class-level. */
	readonly memberName?: string | symbol;

	/**
	 * @param options - Message, code, and target are required; other fields are diagnostic context.
	 */
	constructor(options: AnnotateErrorOptions) {
		super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
		this.code = options.code;
		this.target = options.target;
		this.key = options.key;
		this.kind = options.kind;
		this.memberName = options.memberName;
	}
}

/**
 * Thrown when a factory would attach metadata to a class or member that already
 * has metadata for that factory. `code` is {@link AnnotateErrorCode.DUPLICATE}.
 */
export class DuplicateMetadataError extends AnnotateError {
	override readonly name: string = "DuplicateMetadataError";

	/**
	 * @param ctor - The decorated class
	 * @param key - Metadata key in conflict
	 * @param cardinality - Resolved cardinality of `key` (caller already looked it up)
	 * @param kind - Decoration kind (class vs member, etc.)
	 * @param memberName - Set for member-level duplicate; omit for class-level
	 */
	constructor(
		ctor: AnyConstructor,
		key: MetadataKey,
		cardinality: Cardinality,
		kind: DecoratedKind,
		memberName?: string | symbol
	) {
		const slot = memberName
			? `"${String(memberName)}" on "${targetDisplayName(ctor)}"`
			: `"${targetDisplayName(ctor)}"`;
		const keyLabel = keyDisplayName(key);
		super({
			code: AnnotateErrorCode.DUPLICATE,
			key,
			kind,
			target: ctor,
			memberName,
			message: `duplicate decoration [${cardinality} key "${keyLabel}"]: ${slot} already has metadata for this factory`,
		});
	}
}

/**
 * Thrown by `firstOrThrow` read helpers when no metadata entry exists for the
 * requested factory on a registered class or member. `code` is
 * {@link AnnotateErrorCode.MISSING}.
 */
export class MissingMetadataError extends AnnotateError {
	override readonly name: string = "MissingMetadataError";

	/**
	 * @param args.target - Class the read was performed on
	 * @param args.key - Metadata key whose entry was missing
	 * @param args.label - Decorator name shown in the message
	 * @param args.kind - Decoration kind (class vs member)
	 * @param args.memberName - Set for member-level reads; omit for class-level
	 */
	constructor(args: {
		target: AnyConstructor;
		key: MetadataKey;
		label: string;
		kind: DecoratedKind;
		memberName?: string | symbol;
	}) {
		const className = targetDisplayName(args.target);
		const slot = args.memberName === undefined ? className : `${className}.${String(args.memberName)}`;
		super({
			code: AnnotateErrorCode.MISSING,
			key: args.key,
			kind: args.kind,
			memberName: args.memberName,
			target: args.target,
			message: `@${args.label} metadata missing on "${slot}"`,
		});
	}
}

/**
 * Thrown when metadata is read for a class that was not registered (no
 * matching decoration / prepare). `code` is {@link AnnotateErrorCode.UNREGISTERED}.
 */
export class UnregisteredClassError extends AnnotateError {
	override readonly name: string = "UnregisteredClassError";

	/**
	 * @param target - The class that had no registered metadata
	 */
	constructor(target: AnyConstructor) {
		super({
			code: AnnotateErrorCode.UNREGISTERED,
			target,
			message:
				`@zendrex/annotate: no registered metadata for "${targetDisplayName(target)}". ` +
				"Causes: missing decorator import, bundler tree-shake of the decoration module, " +
				`legacy "experimentalDecorators: true" emit, or instance-member-only class with ` +
				"no class decorator (call prepare(ctor) before reflect).",
		});
	}
}

/**
 * Thrown when a decorator is applied to a class (or member) that does not
 * extend the required base. `code` is {@link AnnotateErrorCode.INVALID_TARGET}.
 */
export class InvalidDecorationTargetError extends AnnotateError {
	override readonly name: string = "InvalidDecorationTargetError";

	/** The superclass the decorated type was expected to extend. */
	readonly requiredBase: AnyConstructor;

	/**
	 * @param args.label - Decorator name shown in the message
	 * @param args.target - The invalid decorated class
	 * @param args.requiredBase - Required base class (exposed on {@link InvalidDecorationTargetError#requiredBase})
	 * @param args.kind - Decoration kind
	 * @param args.memberName - Member under decoration, if applicable
	 * @param args.key - Metadata key for the factory
	 */
	constructor(args: {
		label: string;
		target: AnyConstructor;
		requiredBase: AnyConstructor;
		kind: DecoratedKind;
		memberName?: string | symbol;
		key: MetadataKey;
	}) {
		const className = targetDisplayName(args.target);
		const baseName = targetDisplayName(args.requiredBase);
		const memberSuffix = args.memberName === undefined ? "" : `.${String(args.memberName)}`;
		super({
			code: AnnotateErrorCode.INVALID_TARGET,
			key: args.key,
			kind: args.kind,
			memberName: args.memberName,
			target: args.target,
			message: `@${args.label} cannot decorate ${className}${memberSuffix}: not a subclass of ${baseName}`,
		});
		this.requiredBase = args.requiredBase;
	}
}

/**
 * Thrown when a metadata store operation targets a symbol that is absent from the
 * cardinality registry — i.e. a key not minted via `mintUniqueKey` or `mintListKey`.
 * `code` is {@link AnnotateErrorCode.UNREGISTERED_KEY}.
 */
export class UnregisteredMetadataKeyError extends AnnotateError {
	override readonly name: string = "UnregisteredMetadataKeyError";

	/**
	 * @param target - The class whose store was targeted
	 * @param key - The unregistered metadata key
	 */
	constructor(target: AnyConstructor, key: MetadataKey) {
		super({
			code: AnnotateErrorCode.UNREGISTERED_KEY,
			target,
			key,
			message:
				`@zendrex/annotate: metadata key ${String(key)} used on "${targetDisplayName(target)}" ` +
				"was not minted via mintUniqueKey() or mintListKey() and has no registered cardinality.",
		});
	}
}

/**
 * Thrown when a factory rejects configuration or decorated shape during
 * validation. `code` is {@link AnnotateErrorCode.VALIDATION}; optional
 * `cause` chains an underlying error.
 */
export class ValidationError extends AnnotateError {
	override readonly name: string = "ValidationError";

	/**
	 * @param args.label - Decorator or factory name in the message
	 * @param args.target - Class where validation failed
	 * @param args.reason - Human-readable failure detail
	 * @param args.kind - Decoration kind
	 * @param args.memberName - Member under validation, if applicable
	 * @param args.key - Metadata key for the factory
	 * @param args.cause - Optional error forwarded to {@link AnnotateError} / `Error.cause`
	 */
	constructor(args: {
		label: string;
		target: AnyConstructor;
		reason: string;
		kind: DecoratedKind;
		memberName?: string | symbol;
		key: MetadataKey;
		cause?: unknown;
	}) {
		const className = targetDisplayName(args.target);
		const memberSuffix = args.memberName === undefined ? "" : ` on ${className}.${String(args.memberName)}`;
		super({
			code: AnnotateErrorCode.VALIDATION,
			key: args.key,
			kind: args.kind,
			memberName: args.memberName,
			target: args.target,
			message: `@${args.label} validation failed${memberSuffix}: ${args.reason}`,
			cause: args.cause,
		});
	}
}
