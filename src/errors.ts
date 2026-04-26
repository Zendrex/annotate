import { formatSlot, targetDisplayName } from "./reflector/class-name";
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

type AnnotateErrorContext = Pick<AnnotateErrorOptions, "target"> &
	Partial<Pick<AnnotateErrorOptions, "key" | "kind" | "memberName" | "cause">>;

interface AnnotateErrorSpec<TArgs> {
	code: AnnotateErrorCode;
	extract: (args: TArgs) => AnnotateErrorContext;
	format: (args: TArgs) => string;
	name: string;
}

/**
 * Builds a concrete `AnnotateError` subclass from a uniform spec. The returned
 * class accepts a single `args` value, derives the context fields and message
 * via the spec, and forwards to {@link AnnotateError}'s constructor. The
 * subclass `.name` and instance `.name` both equal `spec.name`.
 */
export function defineAnnotateError<TArgs>(spec: AnnotateErrorSpec<TArgs>): new (args: TArgs) => AnnotateError {
	class DerivedAnnotateError extends AnnotateError {
		override readonly name: string = spec.name;

		constructor(args: TArgs) {
			const context = spec.extract(args);
			super({
				code: spec.code,
				message: spec.format(args),
				target: context.target,
				key: context.key,
				kind: context.kind,
				memberName: context.memberName,
				cause: context.cause,
			});
		}
	}

	Object.defineProperty(DerivedAnnotateError, "name", { value: spec.name, configurable: true });
	return DerivedAnnotateError;
}

interface DuplicateMetadataArgs {
	cardinality: Cardinality;
	ctor: AnyConstructor;
	key: MetadataKey;
	kind: DecoratedKind;
	memberName?: string | symbol;
}

/**
 * Thrown when a factory would attach metadata to a class or member that already
 * has metadata for that factory. `code` is {@link AnnotateErrorCode.DUPLICATE}.
 */
export class DuplicateMetadataError extends defineAnnotateError<DuplicateMetadataArgs>({
	name: "DuplicateMetadataError",
	code: AnnotateErrorCode.DUPLICATE,
	format: ({ ctor, key, cardinality, memberName }) =>
		`duplicate decoration [${cardinality} key "${keyDisplayName(key)}"]: "${formatSlot(ctor, memberName)}" already has metadata for this factory`,
	extract: ({ ctor, key, kind, memberName }) => ({ target: ctor, key, kind, memberName }),
}) {
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
		super({ ctor, key, cardinality, kind, memberName });
	}
}

interface MissingMetadataArgs {
	key: MetadataKey;
	kind: DecoratedKind;
	label: string;
	memberName?: string | symbol;
	target: AnyConstructor;
}

/**
 * Thrown by `firstOrThrow` read helpers when no metadata entry exists for the
 * requested factory on a registered class or member. `code` is
 * {@link AnnotateErrorCode.MISSING}.
 */
export const MissingMetadataError = defineAnnotateError<MissingMetadataArgs>({
	name: "MissingMetadataError",
	code: AnnotateErrorCode.MISSING,
	format: ({ target, label, memberName }) => `@${label} metadata missing on "${formatSlot(target, memberName)}"`,
	extract: ({ target, key, kind, memberName }) => ({ target, key, kind, memberName }),
});

export interface MissingMetadataError extends AnnotateError {}

/**
 * Thrown when metadata is read for a class that was not registered (no
 * matching decoration / prepare). `code` is {@link AnnotateErrorCode.UNREGISTERED}.
 */
export const UnregisteredClassError = defineAnnotateError<AnyConstructor>({
	name: "UnregisteredClassError",
	code: AnnotateErrorCode.UNREGISTERED,
	format: (target) =>
		`@zendrex/annotate: no registered metadata for "${targetDisplayName(target)}". ` +
		"Causes: missing decorator import, bundler tree-shake of the decoration module, " +
		`legacy "experimentalDecorators: true" emit, or instance-member-only class with ` +
		"no class decorator (call prepare(ctor) before reflect).",
	extract: (target) => ({ target }),
});

export interface UnregisteredClassError extends AnnotateError {}

interface InvalidDecorationTargetArgs {
	key: MetadataKey;
	kind: DecoratedKind;
	label: string;
	memberName?: string | symbol;
	requiredBase: AnyConstructor;
	target: AnyConstructor;
}

/**
 * Thrown when a decorator is applied to a class (or member) that does not
 * extend the required base. `code` is {@link AnnotateErrorCode.INVALID_TARGET}.
 */
export class InvalidDecorationTargetError extends defineAnnotateError<InvalidDecorationTargetArgs>({
	name: "InvalidDecorationTargetError",
	code: AnnotateErrorCode.INVALID_TARGET,
	format: ({ label, target, requiredBase, memberName }) =>
		`@${label} cannot decorate ${formatSlot(target, memberName)}: not a subclass of ${targetDisplayName(requiredBase)}`,
	extract: ({ target, key, kind, memberName }) => ({ target, key, kind, memberName }),
}) {
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
	constructor(args: InvalidDecorationTargetArgs) {
		super(args);
		this.requiredBase = args.requiredBase;
	}
}

/**
 * Thrown when a metadata store operation targets a symbol that is absent from the
 * cardinality registry — i.e. a key not minted via `mintUniqueKey` or `mintListKey`.
 * `code` is {@link AnnotateErrorCode.UNREGISTERED_KEY}.
 */
export class UnregisteredMetadataKeyError extends defineAnnotateError<{ target: AnyConstructor; key: MetadataKey }>({
	name: "UnregisteredMetadataKeyError",
	code: AnnotateErrorCode.UNREGISTERED_KEY,
	format: ({ target, key }) =>
		`@zendrex/annotate: metadata key ${String(key)} used on "${targetDisplayName(target)}" ` +
		"was not minted via mintUniqueKey() or mintListKey() and has no registered cardinality.",
	extract: ({ target, key }) => ({ target, key }),
}) {
	/**
	 * @param target - The class whose store was targeted
	 * @param key - The unregistered metadata key
	 */
	constructor(target: AnyConstructor, key: MetadataKey) {
		super({ target, key });
	}
}

interface ValidationArgs {
	cause?: unknown;
	key: MetadataKey;
	kind: DecoratedKind;
	label: string;
	memberName?: string | symbol;
	reason: string;
	target: AnyConstructor;
}

/**
 * Thrown when a factory rejects configuration or decorated shape during
 * validation. `code` is {@link AnnotateErrorCode.VALIDATION}; optional
 * `cause` chains an underlying error.
 */
export const ValidationError = defineAnnotateError<ValidationArgs>({
	name: "ValidationError",
	code: AnnotateErrorCode.VALIDATION,
	format: ({ label, target, reason, memberName }) => {
		const slotPrefix = memberName === undefined ? "" : ` on ${formatSlot(target, memberName)}`;
		return `@${label} validation failed${slotPrefix}: ${reason}`;
	},
	extract: ({ target, key, kind, memberName, cause }) => ({ target, key, kind, memberName, cause }),
});

export interface ValidationError extends AnnotateError {}
