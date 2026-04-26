import { keyDisplayName, MissingMetadataError, UnregisteredClassError } from "../errors";
import {
	collectClassMeta,
	firstClassMetaForKey,
	hasAnyClassMetaForKey,
	hasOwnClassMeta,
} from "../metadata/class-meta-store";
import { hasAnyMeta } from "../metadata/has-any-meta";
import {
	appendMemberMeta,
	collectMemberMeta,
	firstMemberMetaForKey,
	hasAnyMemberMetaForKey,
	hasOwnMemberMeta,
} from "../metadata/member-meta-store";
import { registerCtor } from "../metadata/metadata-ctor-correlation";
import { flushFor, queueDeferred } from "../metadata/metadata-deferred-queue";
import { resolveReflectTarget } from "../reflector/resolve-instance";
import { createScopedReflector } from "../reflector/scoped-reflector";
import { prepare } from "../runtime/prepare";
import { walkPrototypeChain } from "../runtime/prototype-chain";
import { asDeferredValidators, buildValidatorChain, chainValidators, runValidatorChain } from "./validator-chain";
import type { Cardinality, Ctor, Deferred, MemberKind, MetadataArray, MetadataKey } from "../metadata/types";
import type { AnyConstructor, DecoratedKind, ScopedReflector } from "../reflector/types";
import type { DecoratorOptions, DeriveOptions } from "./types";
import type { ValidateContext, ValidatorFn } from "./validator-types";

/**
 * Applies the optional `compose` mapper, falling back to `args[0]` for the
 * identity-tuple case. Overloads distinguish the public single-arg shape from
 * the internal call with a configured `composeFn`.
 */
export function compose<TMeta>(args: [TMeta]): TMeta;
export function compose<TMeta, TArgs extends unknown[]>(args: TArgs, fn: ((...a: TArgs) => TMeta) | undefined): TMeta;
export function compose<TMeta, TArgs extends unknown[]>(args: TArgs, fn?: (...a: TArgs) => TMeta): TMeta {
	return fn ? fn(...args) : (args[0] as TMeta);
}

/** Resolves a display label from the explicit `name` option or the key. */
export function labelFor(name: string | undefined, key: MetadataKey): string {
	return name ?? keyDisplayName(key);
}

/**
 * Common setup for every `build*Factory`: extracts `compose`, derives the
 * display label, and builds the validator chain.
 */
export function prepareFactoryShell<TMeta, TArgs extends unknown[]>(
	key: MetadataKey<TMeta>,
	options: DecoratorOptions<TMeta, TArgs> | undefined
): {
	composeFn: ((...args: TArgs) => TMeta) | undefined;
	label: string;
	validators: ValidatorFn<TMeta>[] | undefined;
} {
	const { compose: composeFn, name } = options ?? {};
	const label = labelFor(name, key);
	const validators = buildValidatorChain<TMeta>(options, label, key);
	return { composeFn, label, validators };
}

/** @throws {MissingMetadataError} Always; used by class `firstOrThrow` when the key has no entry. */
export function throwMissingClass(key: MetadataKey, ctor: AnyConstructor, label: string): never {
	throw new MissingMetadataError({ key, kind: "class", target: ctor, label });
}

/** @throws {MissingMetadataError} Always; used by member `firstOrThrow` when the key has no entry. */
export function throwMissingMember(
	key: MetadataKey,
	kind: Extract<DecoratedKind, "method" | "property">,
	ctor: AnyConstructor,
	member: string | symbol,
	label: string
): never {
	throw new MissingMetadataError({ key, kind, target: ctor, memberName: member, label });
}

/**
 * Asserts the constructor has at least one class- or member-level entry so
 * read helpers fail fast on unregistered types.
 *
 * @throws {UnregisteredClassError} When no metadata is associated with `ctor`.
 */
export function ensureClassRegistered(ctor: Ctor): void {
	if (!hasAnyMeta(ctor)) {
		throw new UnregisteredClassError(ctor as AnyConstructor);
	}
}

function prepareForRead(target: object): Ctor {
	const ctor = resolveReflectTarget(target);
	prepare(ctor);
	return ctor;
}

/**
 * Returns a reader that collects all metadata entries for `memberName` on
 * `key`. Static reads target the constructor directly; instance reads walk
 * the instance's prototype chain.
 */
export function createMemberMetadataReader<TMeta>(
	key: MetadataKey<TMeta>,
	memberName: string | symbol,
	isStatic: boolean
): (instance: object) => TMeta[] {
	return (instance: object): TMeta[] => {
		const ctor = isStatic ? (instance as unknown as Ctor) : (instance as { constructor: Ctor }).constructor;
		return collectMemberMeta<TMeta>(ctor, key, memberName);
	};
}

interface MemberEmitContext {
	addInitializer(initializer: (this: unknown) => void): void;
	readonly metadata: object | null;
	readonly name: string | symbol;
	readonly static: boolean;
}

/**
 * Commit envelope for class- and static-member decorators: validates, runs
 * the kind-specific `append`, correlates the constructor with the decorator
 * context bag, then flushes any reflector work deferred against that bag.
 *
 * Instance-member decorators bypass this helper; their work is queued via
 * {@link queueDeferred} and drained by `prepare`.
 */
export function commitDecoration<TMeta>(params: {
	append: () => void;
	correlation: object | null;
	ctor: Ctor;
	meta: TMeta;
	validationContext: ValidateContext;
	validators?: readonly ValidatorFn<TMeta>[];
}): void {
	const { append, correlation, ctor, meta, validationContext, validators } = params;
	if (validators) {
		runValidatorChain(validators, meta, validationContext);
	}
	append();
	registerCtor(ctor, correlation);
	flushFor(ctor, correlation);
}

/**
 * Emits a member decoration. Static members validate and commit immediately;
 * instance members are queued via {@link queueDeferred} and drained when
 * `prepare` walks the prototype chain. The `token` guards against
 * double-commit; cardinality is resolved from the registry inside
 * `appendMemberMeta`.
 */
export function emitMemberDecoration<TMeta>(params: {
	context: MemberEmitContext;
	key: MetadataKey;
	kind: MemberKind;
	meta: TMeta;
	token: symbol;
	validators?: readonly ValidatorFn<TMeta>[];
}): void {
	const { context, key, kind, meta, token, validators } = params;
	const correlation = context.metadata;
	const memberName = context.name;
	const isStatic = context.static;

	if (isStatic) {
		context.addInitializer(function (this: unknown) {
			const ctor = this as Ctor;
			// Validate, commit, then flush; flush drains sibling instance deferreds on the same bag.
			commitDecoration({
				ctor,
				correlation,
				meta,
				validators,
				validationContext: {
					target: ctor as AnyConstructor,
					memberName,
					kind,
					static: true,
				},
				append: () => {
					appendMemberMeta(ctor, key, memberName, meta, token, { static: true, kind });
				},
			});
		});
		return;
	}

	const deferred: Deferred = {
		key,
		name: memberName,
		meta,
		token,
		static: false,
		kind,
	};
	if (validators) {
		deferred.validators = asDeferredValidators(validators);
	}
	queueDeferred(correlation, deferred);
	context.addInitializer(function (this: unknown) {
		// `prepare` each link so ancestor pending deferreds run on instance construction.
		walkPrototypeChain((this as { constructor: Ctor }).constructor, (ctor) => {
			prepare(ctor);
		});
	});
}

/**
 * Merges a base factory's {@link DecoratorOptions} with a `derive` child's
 * {@link DeriveOptions}. `validate` chains parent-then-child via
 * `chainValidators`; `name` and `requireInstanceOf` prefer the child when
 * present; `compose` only ever comes from the parent (it is absent from
 * `DeriveOptions`).
 */
export function mergeExtendedOptions<TMeta, TArgs extends unknown[]>(
	parent: DecoratorOptions<TMeta, TArgs> | undefined,
	child: DeriveOptions<TMeta, TArgs> | undefined
): DecoratorOptions<TMeta, TArgs> {
	const validate = chainValidators<TMeta>(parent?.validate, child?.validate);
	// Build with a non-conditional shape; the final cast is sound because the
	// parent already satisfied `ComposeRequirement` and is the only source of
	// `compose` (absent from `DeriveOptions`).
	const merged: {
		compose?: (...args: TArgs) => TMeta;
		name?: string;
		requireInstanceOf?: AnyConstructor;
		validate?: ValidatorFn<TMeta>;
	} = {};
	if (parent?.compose) {
		merged.compose = parent.compose;
	}
	const requireInstanceOf = child?.requireInstanceOf ?? parent?.requireInstanceOf;
	if (requireInstanceOf) {
		merged.requireInstanceOf = requireInstanceOf;
	}
	if (validate) {
		merged.validate = validate;
	}
	const name = child?.name ?? parent?.name;
	if (name !== undefined) {
		merged.name = name;
	}
	return merged as DecoratorOptions<TMeta, TArgs>;
}

/**
 * Builds the read-side helpers attached to a class factory, sharing one `key`
 * and error `label`.
 *
 * - **reader** — scoped reflector for `key`.
 * - **first** / **firstOrThrow** — first class-scoped entry; throw variant
 *   raises `MissingMetadataError` when absent.
 * - **has** / **hasOwn** — entry exists anywhere on the class chain vs only
 *   on the constructor.
 * - **all** — frozen list of class-level entries in declaration order.
 */
export function createClassFactoryHelpers<TMeta, TCard extends Cardinality = "unique">(
	key: MetadataKey<TMeta, TCard>,
	label: string
) {
	const firstClassMeta = (ctor: Ctor): TMeta | undefined => firstClassMetaForKey<TMeta>(ctor, key);

	return {
		reader: (target: object): ScopedReflector<TMeta, TCard> => {
			const ctor = prepareForRead(target);
			return createScopedReflector<TMeta, TCard>(ctor, key);
		},
		first: (target: object): TMeta | undefined => {
			const ctor = prepareForRead(target);
			ensureClassRegistered(ctor);
			return firstClassMeta(ctor);
		},
		firstOrThrow: (target: object): TMeta => {
			const ctor = prepareForRead(target);
			ensureClassRegistered(ctor);
			const entry = firstClassMeta(ctor);
			return entry === undefined ? throwMissingClass(key, ctor, label) : entry;
		},
		has: (target: object): boolean => {
			const ctor = prepareForRead(target);
			return hasAnyClassMetaForKey(ctor, key);
		},
		hasOwn: (target: object): boolean => {
			const ctor = prepareForRead(target);
			return hasOwnClassMeta(ctor, key);
		},
		all: (target: object): MetadataArray<TMeta> => {
			const ctor = prepareForRead(target);
			ensureClassRegistered(ctor);
			return Object.freeze(collectClassMeta<TMeta>(ctor, key)) as MetadataArray<TMeta>;
		},
	};
}

/**
 * Builds the read-side helpers attached to a member (method/property)
 * factory, sharing one `key` and error `label`.
 *
 * - **reader** — scoped reflector for `key` (same shape as the class factory).
 * - **first** / **firstOrThrow** — first entry for `(target, member)`; throw
 *   variant raises `MissingMetadataError` when absent.
 * - **has** / **hasOwn** — any vs own entry for `member + key`.
 * - **all** — frozen list of all entries for `member + key` in declaration order.
 */
export function createMemberFactoryHelpers<TMeta, TCard extends Cardinality = "unique">(
	key: MetadataKey<TMeta, TCard>,
	kind: Extract<DecoratedKind, "method" | "property">,
	label: string
) {
	const firstMemberMeta = (ctor: Ctor, member: string | symbol): TMeta | undefined =>
		firstMemberMetaForKey<TMeta>(ctor, key, member);

	return {
		reader: (target: object): ScopedReflector<TMeta, TCard> => {
			const ctor = prepareForRead(target);
			return createScopedReflector<TMeta, TCard>(ctor, key);
		},
		first: (target: object, member: string | symbol): TMeta | undefined => {
			const ctor = prepareForRead(target);
			ensureClassRegistered(ctor);
			return firstMemberMeta(ctor, member);
		},
		firstOrThrow: (target: object, member: string | symbol): TMeta => {
			const ctor = prepareForRead(target);
			ensureClassRegistered(ctor);
			const entry = firstMemberMeta(ctor, member);
			return entry === undefined ? throwMissingMember(key, kind, ctor, member, label) : entry;
		},
		has: (target: object, member: string | symbol): boolean => {
			const ctor = prepareForRead(target);
			return hasAnyMemberMetaForKey(ctor, key, member);
		},
		hasOwn: (target: object, member: string | symbol): boolean => {
			const ctor = prepareForRead(target);
			return hasOwnMemberMeta(ctor, key, member);
		},
		all: (target: object, member: string | symbol): MetadataArray<TMeta> => {
			const ctor = prepareForRead(target);
			ensureClassRegistered(ctor);
			return Object.freeze(collectMemberMeta<TMeta>(ctor, key, member)) as MetadataArray<TMeta>;
		},
	};
}
