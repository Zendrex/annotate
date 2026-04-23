import { AnnotateError, AnnotateErrorCode } from "../errors";
import { targetDisplayName } from "../reflector/class-name";
import type { MetadataKey } from "../metadata/types";
import type { AnyConstructor, DecoratedKind } from "../reflector/types";

export function compose<TMeta, TArgs extends unknown[]>(args: TArgs, fn?: (...a: TArgs) => TMeta): TMeta {
	return fn ? fn(...args) : (args[0] as TMeta);
}

let keyCounter = 0;
export function generateKey(label?: string): MetadataKey {
	keyCounter += 1;
	return Symbol(`${label ?? "decorator"}:${keyCounter}`);
}

export function labelFor(name: string | undefined, key: MetadataKey): string {
	return name ?? String(key.description ?? key);
}

export function throwMissingClass(key: MetadataKey, ctor: AnyConstructor, label: string): never {
	throw new AnnotateError({
		key,
		kind: "class",
		code: AnnotateErrorCode.MISSING,
		target: ctor,
		message: `@${label} metadata missing on "${targetDisplayName(ctor)}"`,
	});
}

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

// ---------------------------------------------------------------------------
// v0.x helper stubs
// These satisfy v0.x factory imports while Stage-3 rewrites are in progress.
// Each throws at call time. Remove when all factories are migrated.
// ---------------------------------------------------------------------------

/** @deprecated v0.x helper — migrate factory to Stage-3 collectMemberMeta. */
export function lookupMemberMetadataScalar<T>(
	key: MetadataKey,
	_ctor: AnyConstructor,
	_member: string | symbol
): T | undefined {
	throw new Error(`lookupMemberMetadataScalar called at runtime on key ${String(key)} — migrate to Stage-3 API`);
}

/** @deprecated v0.x helper — migrate factory to Stage-3 collectMemberMeta. */
export function memberMetadataApplied<_T>(key: MetadataKey, _ctor: AnyConstructor, _member: string | symbol): boolean {
	throw new Error(`memberMetadataApplied called at runtime on key ${String(key)} — migrate to Stage-3 API`);
}

/** @deprecated v0.x helper — migrate factory to Stage-3 hasOwnMemberMeta. */
export function memberMetadataAppliedOwn<_T>(
	key: MetadataKey,
	_ctor: AnyConstructor,
	_member: string | symbol
): boolean {
	throw new Error(`memberMetadataAppliedOwn called at runtime on key ${String(key)} — migrate to Stage-3 API`);
}

/** @deprecated v0.x helper — normalize target to AnyConstructor. */
export function normalizeAnnotateErrorTarget(_target: object): AnyConstructor {
	throw new Error("normalizeAnnotateErrorTarget called at runtime — migrate to Stage-3 API");
}

/** @deprecated v0.x helper — migrate factory to DuplicateMetadataError. */
export function throwDuplicateMember(
	key: MetadataKey,
	kind: Extract<DecoratedKind, "method" | "property">,
	ctor: AnyConstructor,
	member: string | symbol,
	label: string
): never {
	throw new AnnotateError({
		key,
		kind,
		code: AnnotateErrorCode.DUPLICATE,
		target: ctor,
		memberName: member,
		message: `@${label} already applied on "${targetDisplayName(ctor)}.${String(member)}"`,
	});
}

/** @deprecated v0.x helper — migrate property-decorator to Stage-3 ClassFieldDecoratorContext. */
export function ensureProperty(_target: object, _member: string | symbol): void {
	throw new Error("ensureProperty called at runtime — migrate to Stage-3 field decorator");
}

/** @deprecated v0.x helper — migrate parameter-decorator to Stage-3 store. */
export function lookupParameterMetadata<T>(
	key: MetadataKey,
	_ctor: AnyConstructor,
	_member: string | symbol | undefined,
	_index: number
): T | undefined {
	throw new Error(`lookupParameterMetadata called at runtime on key ${String(key)} — migrate to Stage-3 API`);
}

/** @deprecated v0.x helper — migrate parameter-decorator to Stage-3 store. */
export function parameterMetadataApplied(
	key: MetadataKey,
	_ctor: AnyConstructor,
	_member: string | symbol | undefined
): boolean {
	throw new Error(`parameterMetadataApplied called at runtime on key ${String(key)} — migrate to Stage-3 API`);
}

/** @deprecated v0.x helper — migrate parameter-decorator to Stage-3 store. */
export function parameterMetadataAppliedOwn(
	key: MetadataKey,
	_ctor: AnyConstructor,
	_member: string | symbol | undefined
): boolean {
	throw new Error(`parameterMetadataAppliedOwn called at runtime on key ${String(key)} — migrate to Stage-3 API`);
}

/** @deprecated v0.x helper — migrate property-interceptor to Stage-3 accessor decorator. */
export function toAccessor(_target: object, _member: string | symbol): PropertyDescriptor {
	throw new Error("toAccessor called at runtime — migrate to Stage-3 accessor decorator");
}

/** @deprecated v0.x helper — migrate parameter-decorator to AnnotateError. */
export function throwMissingParameter(
	key: MetadataKey,
	ctor: AnyConstructor,
	index: number,
	label: string,
	member?: string | symbol
): never {
	const slot = member ? `parameter ${index} of "${String(member)}"` : `constructor parameter ${index}`;
	throw new AnnotateError({
		key,
		kind: "class",
		code: AnnotateErrorCode.MISSING,
		target: ctor,
		memberName: member,
		parameterIndex: index,
		message: `@${label} metadata missing on ${slot} of "${targetDisplayName(ctor)}"`,
	});
}
