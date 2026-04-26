import { formatSlot, targetDisplayName } from "./reflector/class-name";
import type { Cardinality, MetadataKey } from "./metadata/types";
import type { AnyConstructor, DecoratedKind } from "./reflector/types";

/**
 * Stable codes for {@link AnnotateError#code}. Branch on these (or
 * `instanceof`) instead of matching messages; each value has a dedicated
 * subclass in this module.
 */
export const AnnotateErrorCode = {
	DUPLICATE: "duplicate",
	MISSING: "missing",
	UNREGISTERED: "unregistered",
	UNREGISTERED_KEY: "unregisteredKey",
	INVALID_TARGET: "invalidTarget",
	VALIDATION: "validation",
} as const;

export type AnnotateErrorCode = (typeof AnnotateErrorCode)[keyof typeof AnnotateErrorCode];

/**
 * Human-readable display string for a metadata key: prefers `description`,
 * falling back to `String(key)` (e.g. `"Symbol()"`) when missing.
 */
export function keyDisplayName(key: MetadataKey): string {
	return key.description ?? String(key);
}

/** Constructor options for {@link AnnotateError}; optional fields enrich diagnostics. */
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
 * Base error for the library. Branch on {@link AnnotateError#code} or
 * `instanceof` a concrete subclass; message strings are humans-only.
 */
export class AnnotateError extends Error {
	override readonly name: string = "AnnotateError";

	readonly code: AnnotateErrorCode;
	/** Class constructor the operation referred to. */
	readonly target: AnyConstructor;

	/** Factory metadata key, when the failure relates to a specific entry. */
	readonly key?: MetadataKey;

	/** What was decorated (class, method, field, etc.), when known. */
	readonly kind?: DecoratedKind;

	/** Property or method name for member-level issues; absent for class-level. */
	readonly memberName?: string | symbol;

	constructor(options: AnnotateErrorOptions) {
		super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
		this.code = options.code;
		this.target = options.target;
		this.key = options.key;
		this.kind = options.kind;
		this.memberName = options.memberName;
	}
}

type AnnotateErrorContext = Pick<AnnotateErrorOptions, "target" | "key" | "kind" | "memberName" | "cause">;

interface AnnotateErrorSpec<TArgs> {
	code: AnnotateErrorCode;
	format: (args: TArgs) => string;
	name: string;
	toContext: (args: TArgs) => AnnotateErrorContext;
}

/**
 * Builds a concrete {@link AnnotateError} subclass from a uniform spec. The
 * returned class accepts a single `args` value, derives the message and
 * diagnostic context via `spec`, and forwards to the base constructor. Both
 * the class `.name` and instance `.name` equal `spec.name`.
 */
export function defineAnnotateError<TArgs>(spec: AnnotateErrorSpec<TArgs>): new (args: TArgs) => AnnotateError {
	class DerivedAnnotateError extends AnnotateError {
		override readonly name: string = spec.name;

		constructor(args: TArgs) {
			super({ code: spec.code, message: spec.format(args), ...spec.toContext(args) });
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
 * Thrown when a unique-cardinality factory would attach a second metadata
 * entry to a class or member that already holds one for the same key.
 * `code` is {@link AnnotateErrorCode.DUPLICATE}.
 */
export class DuplicateMetadataError extends defineAnnotateError<DuplicateMetadataArgs>({
	name: "DuplicateMetadataError",
	code: AnnotateErrorCode.DUPLICATE,
	format: ({ ctor, key, cardinality, memberName }) =>
		`duplicate decoration [${cardinality} key "${keyDisplayName(key)}"]: "${formatSlot(ctor, memberName)}" already has metadata for this factory`,
	toContext: ({ ctor, key, kind, memberName }) => ({ target: ctor, key, kind, memberName }),
}) {
	/**
	 * @param cardinality - Resolved cardinality of `key`; caller pre-looks it up
	 *   to keep this constructor pure.
	 * @param memberName - Set for member-level duplicates; omit for class-level.
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
 * Thrown by `firstOrThrow` reads when a registered class or member has no
 * metadata entry for the requested factory. `code` is
 * {@link AnnotateErrorCode.MISSING}.
 */
export class MissingMetadataError extends defineAnnotateError<MissingMetadataArgs>({
	name: "MissingMetadataError",
	code: AnnotateErrorCode.MISSING,
	format: ({ target, label, memberName }) => `@${label} metadata missing on "${formatSlot(target, memberName)}"`,
	toContext: ({ target, key, kind, memberName }) => ({ target, key, kind, memberName }),
}) {}

/**
 * Thrown when metadata is read for a class that was never registered — no
 * decoration ran, decorations were tree-shaken, legacy
 * `experimentalDecorators` emit was used, or `prepare(ctor)` was not called
 * for an instance-member-only class. `code` is
 * {@link AnnotateErrorCode.UNREGISTERED}.
 */
export class UnregisteredClassError extends defineAnnotateError<AnyConstructor>({
	name: "UnregisteredClassError",
	code: AnnotateErrorCode.UNREGISTERED,
	format: (target) =>
		`@zendrex/annotate: no registered metadata for "${targetDisplayName(target)}". ` +
		"Causes: missing decorator import, bundler tree-shake of the decoration module, " +
		`legacy "experimentalDecorators: true" emit, or instance-member-only class with ` +
		"no class decorator (call prepare(ctor) before reflect).",
	toContext: (target) => ({ target }),
}) {}

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
 * extend the factory's required base class. `code` is
 * {@link AnnotateErrorCode.INVALID_TARGET}.
 */
export class InvalidDecorationTargetError extends defineAnnotateError<InvalidDecorationTargetArgs>({
	name: "InvalidDecorationTargetError",
	code: AnnotateErrorCode.INVALID_TARGET,
	format: ({ label, target, requiredBase, memberName }) =>
		`@${label} cannot decorate ${formatSlot(target, memberName)}: not a subclass of ${targetDisplayName(requiredBase)}`,
	toContext: ({ target, key, kind, memberName }) => ({ target, key, kind, memberName }),
}) {
	/** The superclass the decorated type was expected to extend. */
	readonly requiredBase: AnyConstructor;

	constructor(args: InvalidDecorationTargetArgs) {
		super(args);
		this.requiredBase = args.requiredBase;
	}
}

/**
 * Thrown when a store operation receives a symbol that was not minted via
 * `mintUniqueKey` or `mintListKey`, so its cardinality is unknown. `code` is
 * {@link AnnotateErrorCode.UNREGISTERED_KEY}.
 */
export class UnregisteredMetadataKeyError extends defineAnnotateError<{ target: AnyConstructor; key: MetadataKey }>({
	name: "UnregisteredMetadataKeyError",
	code: AnnotateErrorCode.UNREGISTERED_KEY,
	format: ({ target, key }) =>
		`@zendrex/annotate: metadata key ${String(key)} used on "${targetDisplayName(target)}" ` +
		"was not minted via mintUniqueKey() or mintListKey() and has no registered cardinality.",
	toContext: ({ target, key }) => ({ target, key }),
}) {
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
 * Thrown when a factory's `validate` hook rejects configuration or the
 * decorated shape. `code` is {@link AnnotateErrorCode.VALIDATION}; an optional
 * `cause` chains the underlying error.
 */
export class ValidationError extends defineAnnotateError<ValidationArgs>({
	name: "ValidationError",
	code: AnnotateErrorCode.VALIDATION,
	format: ({ label, target, reason, memberName }) => {
		const slotPrefix = memberName === undefined ? "" : ` on ${formatSlot(target, memberName)}`;
		return `@${label} validation failed${slotPrefix}: ${reason}`;
	},
	toContext: ({ target, key, kind, memberName, cause }) => ({ target, key, kind, memberName, cause }),
}) {}
