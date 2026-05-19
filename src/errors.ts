import { formatSlot, targetDisplayName } from "./reflector/class-name";
import type { Cardinality, MetadataKey } from "./metadata/types";
import type { AnyConstructor, DecoratedKind } from "./reflector/types";

/** Stable codes for `AnnotateError#code`; prefer `instanceof` over message matching. */
export const AnnotateErrorCode = {
	DUPLICATE: "duplicate",
	MISSING: "missing",
	UNREGISTERED: "unregistered",
	UNREGISTERED_KEY: "unregisteredKey",
	INVALID_TARGET: "invalidTarget",
	INVALID_SELECTOR: "invalidSelector",
	VALIDATION: "validation",
} as const;

export type AnnotateErrorCode = (typeof AnnotateErrorCode)[keyof typeof AnnotateErrorCode];

export function keyDisplayName(key: MetadataKey): string {
	return key.description ?? String(key);
}

export interface AnnotateErrorOptions {
	cause?: unknown;
	code: AnnotateErrorCode;
	key?: MetadataKey;
	kind?: DecoratedKind;
	memberName?: string | symbol;
	message: string;
	target: AnyConstructor;
}

/** Branch on `code` or `instanceof`; messages are for humans only. */
export class AnnotateError extends Error {
	override readonly name: string = "AnnotateError";

	readonly code: AnnotateErrorCode;
	readonly target: AnyConstructor;
	readonly key?: MetadataKey;
	readonly kind?: DecoratedKind;
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

/** Unique-cardinality factory applied twice to the same class or member site. */
export class DuplicateMetadataError extends defineAnnotateError<DuplicateMetadataArgs>({
	name: "DuplicateMetadataError",
	code: AnnotateErrorCode.DUPLICATE,
	format: ({ ctor, key, cardinality, memberName }) =>
		`duplicate decoration [${cardinality} key "${keyDisplayName(key)}"]: "${formatSlot(ctor, memberName)}" already has metadata for this factory`,
	toContext: ({ ctor, key, kind, memberName }) => ({ target: ctor, key, kind, memberName }),
}) {
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

/** `firstOrThrow` found no metadata for the requested factory. */
export class MissingMetadataError extends defineAnnotateError<MissingMetadataArgs>({
	name: "MissingMetadataError",
	code: AnnotateErrorCode.MISSING,
	format: ({ target, label, memberName }) => `@${label} metadata missing on "${formatSlot(target, memberName)}"`,
	toContext: ({ target, key, kind, memberName }) => ({ target, key, kind, memberName }),
}) {}

/**
 * No metadata registered for the class (missing import, tree-shake, legacy emit, or
 * instance-member-only class without `prepare(ctor)`).
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

/** Decorated type does not extend the factory's `requireInstanceOf` base. */
export class InvalidDecorationTargetError extends defineAnnotateError<InvalidDecorationTargetArgs>({
	name: "InvalidDecorationTargetError",
	code: AnnotateErrorCode.INVALID_TARGET,
	format: ({ label, target, requiredBase, memberName }) =>
		`@${label} cannot decorate ${formatSlot(target, memberName)}: not a subclass of ${targetDisplayName(requiredBase)}`,
	toContext: ({ target, key, kind, memberName }) => ({ target, key, kind, memberName }),
}) {
	readonly requiredBase: AnyConstructor;

	constructor(args: InvalidDecorationTargetArgs) {
		super(args);
		this.requiredBase = args.requiredBase;
	}
}

/** `Annotate.*.read(...).get(...)` selector did not resolve exactly one public member. */
export class InvalidSelectorError extends defineAnnotateError<{ reason: string; target: AnyConstructor }>({
	name: "InvalidSelectorError",
	code: AnnotateErrorCode.INVALID_SELECTOR,
	format: ({ reason, target }) => `invalid Annotate selector for "${targetDisplayName(target)}": ${reason}`,
	toContext: ({ target }) => ({ target }),
}) {
	constructor(target: AnyConstructor, reason: string) {
		super({ target, reason });
	}
}

/** Store operation used a symbol not minted via `mintUniqueKey` / `mintListKey`. */
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

/** Factory `validate` hook rejected configuration or the decorated shape. */
export class ValidationError extends defineAnnotateError<ValidationArgs>({
	name: "ValidationError",
	code: AnnotateErrorCode.VALIDATION,
	format: ({ label, target, reason, memberName }) => {
		const slotPrefix = memberName === undefined ? "" : ` on ${formatSlot(target, memberName)}`;
		return `@${label} validation failed${slotPrefix}: ${reason}`;
	},
	toContext: ({ target, key, kind, memberName, cause }) => ({ target, key, kind, memberName, cause }),
}) {}
