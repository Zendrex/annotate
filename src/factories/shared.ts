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
import { asDeferredValidators, chainValidators, runValidatorChain } from "./validator-chain";
import type { Cardinality, Ctor, Deferred, MemberKind, MetadataArray, MetadataKey } from "../metadata/types";
import type { AnyConstructor, DecoratedKind, ScopedReflector } from "../reflector/types";
import type { DecoratorOptions, DeriveOptions } from "./types";
import type { ValidateContext, ValidatorFn } from "./validator-types";

/**
 * Produces a single metadata value from factory arguments: if `fn` is set, returns `fn(...args)`;
 * otherwise the first element of `args` is treated as `TMeta` (the common `(...meta) =>` shape).
 */
export function compose<TMeta, TArgs extends unknown[]>(args: TArgs, fn?: (...a: TArgs) => TMeta): TMeta {
	return fn ? fn(...args) : (args[0] as TMeta);
}

/**
 * Resolves a stable display name for the decorator, preferring an explicit `name` when provided.
 */
export function labelFor(name: string | undefined, key: MetadataKey): string {
	return name ?? keyDisplayName(key);
}

/**
 * Throws a structured "metadata missing" error for a class (used by `firstOrThrow` when no entry exists).
 */
export function throwMissingClass(key: MetadataKey, ctor: AnyConstructor, label: string): never {
	throw new MissingMetadataError({ key, kind: "class", target: ctor, label });
}

/**
 * Throws a structured "metadata missing" error for a method or property member.
 */
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
 * Ensures the constructor is known to the metadata system (any class- or member-level entry); used by
 * read helpers so unregistered types fail fast.
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
 * Returns a per-member reader that returns all metadata entries for `memberName` on the given key,
 * using instance vs static rules (`static` — metadata lives on the constructor; otherwise on the instance prototype chain).
 */
export function createMemberMetadataReader<TMeta>(
	key: MetadataKey,
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
 * Shared commit envelope for class- and static-member decorators: runs the optional
 * validator chain, performs the kind-specific append via `append`, then correlates
 * the constructor with the decorator-context metadata bag and flushes any deferred
 * reflector work for that bag.
 *
 * Instance-member decorators do not use this helper because their work is queued
 * via {@link queueDeferred} and drained later by `prepare`.
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
 * Emits a member decoration: for static members, validators run and metadata commits immediately; for
 * instance members, work is {@link queueDeferred} until `prepare` drains the chain. The `token` prevents
 * double-commit; cardinality (unique vs list) is resolved from the registry inside `appendMemberMeta`.
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
 * Merges a base factory’s {@link DecoratorOptions} with a `derive` child’s {@link DeriveOptions}.
 * `validate` runs as a chained pipeline via `chainValidators` (parent first, then child). `name` and
 * `requireInstanceOf` are overridden when the child supplies them. `compose` is taken only from the
 * parent (it is not part of `DeriveOptions`).
 */
export function mergeExtendedOptions<TMeta, TArgs extends unknown[]>(
	parent: DecoratorOptions<TMeta, TArgs> | undefined,
	child: DeriveOptions<TMeta, TArgs> | undefined
): DecoratorOptions<TMeta, TArgs> {
	const validate = chainValidators<TMeta>(parent?.validate, child?.validate);
	const merged: DecoratorOptions<TMeta, TArgs> = {};
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
	return merged;
}

/**
 * Read helpers for a class-level metadata key, sharing one `key` and error `label` with the public factory.
 *
 * - **reader** — {@link createScopedReflector} for this `key` (navigate decorated classes, methods, properties).
 * - **first** — first class-scoped value for the key, or `undefined` after {@link ensureClassRegistered}.
 * - **firstOrThrow** — like `first`, but throws if missing.
 * - **has** / **hasOwn** — whether an entry exists anywhere in the class metadata chain / on the constructor only.
 * - **all** — a frozen list of all class-level entries in declaration order.
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
 * Read helpers for a member-level (method/property) metadata `key`, sharing one `key` and error `label`.
 *
 * - **reader** — {@link createScopedReflector} for this `key` (same as class factory `reader`).
 * - **first** — first value for the given `member` on the resolved constructor, or `undefined`.
 * - **firstOrThrow** — like `first`, but throws if missing.
 * - **has** / **hasOwn** — any vs own entry for that member+key.
 * - **all** — frozen list of all entries for the member+key in declaration order.
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
