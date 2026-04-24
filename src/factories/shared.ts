import { AnnotateError, AnnotateErrorCode, UnregisteredClassError } from "../errors";
import {
	appendMemberMeta,
	collectClassMeta,
	collectMemberMeta,
	flushFor,
	hasAnyClassMeta,
	hasAnyMemberMeta,
	hasOwnClassMeta,
	hasOwnMemberMeta,
	queueDeferred,
	registerCtor,
} from "../metadata/store";
import { targetDisplayName } from "../reflector/class-name";
import { resolveReflectTarget } from "../reflector/resolve-instance";
import { createScopedReflector } from "../reflector/scoped-reflector";
import { materialize } from "../runtime/materialize";
import { walkPrototypeChain } from "../runtime/prototype-chain";
import type { Ctor, MemberKind, MetadataKey } from "../metadata/types";
import type { AnyConstructor, DecoratedKind, ScopedReflector } from "../reflector/types";

/**
 * Fold decorator arguments into a single metadata value. Uses `options.compose`
 * when provided, otherwise treats the first positional argument as the
 * metadata payload.
 */
export function compose<TMeta, TArgs extends unknown[]>(args: TArgs, fn?: (...a: TArgs) => TMeta): TMeta {
	return fn ? fn(...args) : (args[0] as TMeta);
}

let keyCounter = 0;

/**
 * Mint a fresh {@link MetadataKey} per factory invocation. The monotonic
 * counter guarantees uniqueness even when callers reuse `label`.
 */
export function generateKey(label?: string): MetadataKey {
	keyCounter += 1;
	return Symbol(`${label ?? "decorator"}:${keyCounter}`);
}

/** Resolve the human-readable label used by factory error messages. */
export function labelFor(name: string | undefined, key: MetadataKey): string {
	return name ?? String(key.description ?? key);
}

/** @throws {AnnotateError} With code `MISSING` — class-level metadata absent for `key`. */
export function throwMissingClass(key: MetadataKey, ctor: AnyConstructor, label: string): never {
	throw new AnnotateError({
		key,
		kind: "class",
		code: AnnotateErrorCode.MISSING,
		target: ctor,
		message: `@${label} metadata missing on "${targetDisplayName(ctor)}"`,
	});
}

/** @throws {AnnotateError} With code `MISSING` — member-level metadata absent for `key` on `member`. */
export function throwMissingMember(
	key: MetadataKey,
	kind: Extract<DecoratedKind, "method" | "property">,
	ctor: AnyConstructor,
	member: string | symbol,
	label: string
): never {
	throw new AnnotateError({
		key,
		kind,
		code: AnnotateErrorCode.MISSING,
		target: ctor,
		memberName: member,
		message: `@${label} metadata missing on "${targetDisplayName(ctor)}.${String(member)}"`,
	});
}

/**
 * Guard used by `metadata` / `requireMetadata` helpers to surface a clear
 * failure when a caller reflects on a class that never saw any annotate
 * decorator — mirrors the reflector's collection-method behavior.
 *
 * @throws {UnregisteredClassError} Class has no class- or member-level metadata after auto-materialize.
 */
export function ensureClassRegistered(ctor: Ctor): void {
	if (!(hasAnyClassMeta(ctor) || hasAnyMemberMeta(ctor))) {
		throw new UnregisteredClassError(ctor as AnyConstructor);
	}
}

/**
 * Resolve `target` to a constructor and materialize any pending decorations.
 * Shared entry-point for the non-throwing helpers (`applied`, `appliedOwn`).
 */
function prepareForRead(target: object): Ctor {
	const ctor = resolveReflectTarget(target);
	materialize(ctor);
	return ctor;
}

/**
 * Build a lazy reader that returns the full ancestor-merged metadata array for
 * `(key, memberName)` on the class of `instance`. Shared by method/accessor
 * interceptors; `isStatic` captures whether `instance` arrives as a
 * constructor or as an instance at invocation time.
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

/**
 * Minimal shape the Stage-3 decorator contexts share — enough to drive the
 * `emitMemberDecoration` helper without leaking the variant-specific
 * `ClassMethodDecoratorContext` / `ClassFieldDecoratorContext` /
 * `ClassAccessorDecoratorContext` union into callers.
 */
interface MemberEmitContext {
	addInitializer(initializer: (this: unknown) => void): void;
	readonly metadata: object | null;
	readonly name: string | symbol;
	readonly static: boolean;
}

/**
 * Commit a member-decoration registration from any member-level Stage-3
 * decorator body. Static applications append eagerly and drain pending
 * deferreds in the same initializer; instance applications queue a deferred
 * and register a per-instance initializer whose body materializes the
 * constructing class so pending metadata lands on the correct bucket.
 *
 * The instance initializer body deliberately closes over **nothing** besides
 * the per-instance `this.constructor`. Bun 1.3.13's Stage-3 runtime has a bug
 * where `ctx.addInitializer` on instance field/method contexts is globally
 * shared across classes (only the last-registered initializer survives and
 * fires on every instance of every class). Capturing per-decoration `meta` or
 * `memberName` here would cross-pollute one class's bucket with another's;
 * using only `this.constructor` sidesteps that — whichever initializer Bun
 * actually invokes, it flushes the pending deferreds for the real class of
 * the instance being constructed. `materialize` / `flushFor` are idempotent,
 * so repeated or spurious invocations are safe no-ops.
 */
export function emitMemberDecoration(params: {
	context: MemberEmitContext;
	key: MetadataKey;
	kind: MemberKind;
	meta: unknown;
	token: symbol;
	unique: boolean;
}): void {
	const { context, key, kind, meta, token, unique } = params;
	const correlation = context.metadata;
	const memberName = context.name;
	const isStatic = context.static;

	if (isStatic) {
		context.addInitializer(function (this: unknown) {
			const ctor = this as Ctor;
			appendMemberMeta(ctor, key, memberName, meta, token, { unique, static: true, kind });
			registerCtor(ctor, correlation);
			flushFor(ctor, correlation);
		});
		return;
	}

	queueDeferred(correlation, { key, name: memberName, meta, token, unique, static: false, kind });
	context.addInitializer(function (this: unknown) {
		// Walk the prototype chain so an ancestor's pending deferreds also drain
		// on construction of the most-derived class — `materialize` short-circuits
		// at the first class with own `[Symbol.metadata]` by design.
		walkPrototypeChain((this as { constructor: Ctor }).constructor, (ctor) => {
			materialize(ctor);
		});
	});
}

/**
 * Build the reflector helpers shared by class-decorator factories:
 * `reflect`, `metadata`, `requireMetadata`, `applied`, `appliedOwn`.
 */
export function createClassFactoryHelpers<TMeta>(key: MetadataKey, label: string) {
	const firstClassMeta = (ctor: Ctor): TMeta | undefined => {
		const list = collectClassMeta<TMeta>(ctor, key);
		return list.length > 0 ? list[0] : undefined;
	};

	return {
		reflect: (target: object): ScopedReflector<TMeta> =>
			createScopedReflector<TMeta>(resolveReflectTarget(target), key),
		metadata: (target: object): TMeta | undefined => {
			const ctor = prepareForRead(target);
			ensureClassRegistered(ctor);
			return firstClassMeta(ctor);
		},
		requireMetadata: (target: object): TMeta => {
			const ctor = prepareForRead(target);
			ensureClassRegistered(ctor);
			const first = firstClassMeta(ctor);
			return first === undefined ? throwMissingClass(key, ctor, label) : first;
		},
		applied: (target: object): boolean => {
			const ctor = prepareForRead(target);
			return collectClassMeta<TMeta>(ctor, key).length > 0;
		},
		appliedOwn: (target: object): boolean => {
			const ctor = prepareForRead(target);
			return hasOwnClassMeta(ctor, key);
		},
	};
}

/**
 * Build the reflector helpers shared by member decorator + interceptor
 * factories: `reflect`, `metadata`, `requireMetadata`, `applied`,
 * `appliedOwn`. `kind` is the {@link DecoratedKind} reported by
 * `throwMissingMember` — accessor interceptors report `"property"` because
 * the store classifies auto-accessors as fields.
 */
export function createMemberFactoryHelpers<TMeta>(
	key: MetadataKey,
	kind: Extract<DecoratedKind, "method" | "property">,
	label: string
) {
	const firstMemberMeta = (ctor: Ctor, member: string | symbol): TMeta | undefined => {
		const list = collectMemberMeta<TMeta>(ctor, key, member);
		return list.length > 0 ? list[0] : undefined;
	};

	return {
		reflect: (target: object): ScopedReflector<TMeta> =>
			createScopedReflector<TMeta>(resolveReflectTarget(target), key),
		metadata: (target: object, member: string | symbol): TMeta | undefined => {
			const ctor = prepareForRead(target);
			ensureClassRegistered(ctor);
			return firstMemberMeta(ctor, member);
		},
		requireMetadata: (target: object, member: string | symbol): TMeta => {
			const ctor = prepareForRead(target);
			ensureClassRegistered(ctor);
			const first = firstMemberMeta(ctor, member);
			return first === undefined ? throwMissingMember(key, kind, ctor, member, label) : first;
		},
		applied: (target: object, member: string | symbol): boolean => {
			const ctor = prepareForRead(target);
			return collectMemberMeta<TMeta>(ctor, key, member).length > 0;
		},
		appliedOwn: (target: object, member: string | symbol): boolean => {
			const ctor = prepareForRead(target);
			return hasOwnMemberMeta(ctor, key, member);
		},
	};
}
