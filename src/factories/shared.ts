import { AnnotateError, AnnotateErrorCode, UnregisteredClassError } from "../errors";
import { hasAnyClassMeta, hasAnyMemberMeta } from "../metadata/store";
import { targetDisplayName } from "../reflector/class-name";
import type { MetadataKey } from "../metadata/types";
import type { AnyConstructor, DecoratedKind } from "../reflector/types";

// biome-ignore lint/complexity/noBannedTypes: constructor identity uses Function for parity with metadata/store
type Ctor = Function;

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

// Plan EA-7: factory metadata / requireMetadata helpers throw
// UnregisteredClassError when the class has no annotate metadata anywhere
// (after auto-materialize). Parity with reflector collection methods.
export function ensureClassRegistered(ctor: Ctor): void {
	if (!(hasAnyClassMeta(ctor) || hasAnyMemberMeta(ctor))) {
		throw new UnregisteredClassError(ctor as AnyConstructor);
	}
}
