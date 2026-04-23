import { AnnotateError, AnnotateErrorCode } from "../errors";
import { getMetadata, getMetadataArray, getOwnMetadata, getParameterMap } from "../metadata/store";
import { targetDisplayName } from "../reflector/class-name";
import { resolveConstructorFromInstance } from "../reflector/resolve-instance";
import type { MetadataArray, MetadataKey } from "../metadata/types";
import type { AnyConstructor, DecoratedKind } from "../reflector/types";

export function compose<TMeta, TArgs extends unknown[]>(args: TArgs, fn?: (...a: TArgs) => TMeta): TMeta {
	return fn ? fn(...args) : (args[0] as TMeta);
}

let keyCounter = 0;

export function generateKey(): MetadataKey {
	keyCounter += 1;
	return Symbol(`decorator:${keyCounter}`);
}

/** `target` for {@link AnnotateError}: always a constructor. */
export function normalizeAnnotateErrorTarget(decorationTarget: object): AnyConstructor {
	if (typeof decorationTarget === "function") {
		const fn = decorationTarget as AnyConstructor;
		if (fn.prototype && typeof fn.prototype === "object") {
			return fn;
		}
	}
	return resolveConstructorFromInstance(decorationTarget);
}

export function classMetadataFirst<TMeta>(key: MetadataKey, ctor: AnyConstructor): TMeta | undefined {
	const value = getMetadata<MetadataArray<TMeta>>(key, ctor);
	if (!value || value.length === 0) {
		return undefined;
	}
	return value[0] as TMeta;
}

export function classMetadataApplied<TMeta>(key: MetadataKey, ctor: AnyConstructor): boolean {
	const value = getMetadata<MetadataArray<TMeta>>(key, ctor);
	return !!value && value.length > 0;
}

export function classMetadataAppliedOwn<TMeta>(key: MetadataKey, ctor: AnyConstructor): boolean {
	return getMetadataArray<TMeta>(key, ctor).length > 0;
}

export function lookupMemberMetadataScalar<TMeta>(
	key: MetadataKey,
	ctor: AnyConstructor,
	member: string | symbol
): TMeta | undefined {
	const inherited = getMetadata<MetadataArray<TMeta>>(key, ctor.prototype, member);
	if (inherited && inherited.length > 0) {
		return inherited[0];
	}
	const staticOwn = getOwnMetadata<MetadataArray<TMeta>>(key, ctor, member);
	if (staticOwn && staticOwn.length > 0) {
		return staticOwn[0];
	}
	return undefined;
}

export function memberMetadataApplied<TMeta>(key: MetadataKey, ctor: AnyConstructor, member: string | symbol): boolean {
	return lookupMemberMetadataScalar<TMeta>(key, ctor, member) !== undefined;
}

export function memberMetadataAppliedOwn<TMeta>(
	key: MetadataKey,
	ctor: AnyConstructor,
	member: string | symbol
): boolean {
	return (
		getMetadataArray<TMeta>(key, ctor.prototype, member).length > 0 ||
		getMetadataArray<TMeta>(key, ctor, member).length > 0
	);
}

export function lookupParameterMetadata<TMeta>(
	key: MetadataKey,
	ctor: AnyConstructor,
	parameterIndex: number,
	methodName?: string | symbol
): TMeta | undefined {
	if (methodName === undefined) {
		const map = getParameterMap<TMeta>(key, ctor, undefined);
		const list = map.get(parameterIndex);
		return list && list.length > 0 ? list[0] : undefined;
	}
	let current: object | null = ctor.prototype;
	while (current && current !== Object.prototype) {
		const list = getParameterMap<TMeta>(key, current, methodName).get(parameterIndex);
		if (list && list.length > 0) {
			return list[0];
		}
		current = Object.getPrototypeOf(current);
	}
	const staticList = getParameterMap<TMeta>(key, ctor, methodName).get(parameterIndex);
	return staticList && staticList.length > 0 ? staticList[0] : undefined;
}

export function parameterMetadataApplied<TMeta>(
	key: MetadataKey,
	ctor: AnyConstructor,
	parameterIndex: number,
	methodName?: string | symbol
): boolean {
	return lookupParameterMetadata<TMeta>(key, ctor, parameterIndex, methodName) !== undefined;
}

export function parameterMetadataAppliedOwn<TMeta>(
	key: MetadataKey,
	ctor: AnyConstructor,
	parameterIndex: number,
	methodName?: string | symbol
): boolean {
	if (methodName === undefined) {
		const list = getParameterMap<TMeta>(key, ctor, undefined).get(parameterIndex);
		return !!list && list.length > 0;
	}
	const a = getParameterMap<TMeta>(key, ctor.prototype, methodName).get(parameterIndex);
	const b = getParameterMap<TMeta>(key, ctor, methodName).get(parameterIndex);
	return (!!a && a.length > 0) || (!!b && b.length > 0);
}

export function labelFor(name: string | undefined, key: MetadataKey): string {
	return name ?? String(key.description ?? key);
}

export function throwDuplicateClass(key: MetadataKey, ctor: AnyConstructor, label: string): never {
	throw new AnnotateError({
		key,
		kind: "class",
		code: AnnotateErrorCode.DUPLICATE,
		target: ctor,
		message: `@${label} may only be applied once to "${targetDisplayName(ctor)}"`,
	});
}

export function throwDuplicateMember(
	key: MetadataKey,
	kind: "method" | "property",
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
		message: `@${label} may only be applied once to "${String(member)}" on "${targetDisplayName(ctor)}"`,
	});
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
	kind: "method" | "property",
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

export function throwMissingParameter(
	key: MetadataKey,
	ctor: AnyConstructor,
	parameterIndex: number,
	label: string,
	methodName?: string | symbol
): never {
	const slot =
		methodName === undefined
			? `parameter index ${String(parameterIndex)} of constructor`
			: `parameter index ${String(parameterIndex)} of "${String(methodName)}"`;
	const kind: DecoratedKind = methodName === undefined ? "constructor-parameter" : "method-parameter";
	throw new AnnotateError({
		key,
		kind,
		code: AnnotateErrorCode.MISSING,
		target: ctor,
		parameterIndex,
		memberName: methodName,
		message: `@${label} metadata missing for ${slot} on "${targetDisplayName(ctor)}"`,
	});
}

/** Ensure property key exists on target so reflection can find it. */
export function ensureProperty(target: object, propertyKey: string | symbol): void {
	if (Object.hasOwn(target, propertyKey)) {
		return;
	}
	Object.defineProperty(target, propertyKey, {
		configurable: true,
		enumerable: false,
		writable: true,
		value: undefined,
	});
}

/** Convert data property to accessor descriptor backed by WeakMap (per-instance storage). */
export function toAccessor(target: object, propertyKey: string | symbol): PropertyDescriptor {
	const desc = Object.getOwnPropertyDescriptor(target, propertyKey);

	if (desc?.get || desc?.set) {
		return {
			configurable: true,
			enumerable: false,
			get: desc.get,
			set: desc.set,
		};
	}

	const store = new WeakMap<object, unknown>();
	if (desc && "value" in desc && desc.value !== undefined) {
		store.set(target, desc.value);
	}

	const accessor: PropertyDescriptor = {
		configurable: true,
		enumerable: false,
		get(this: object) {
			return store.get(this);
		},
		set(this: object, value: unknown) {
			store.set(this, value);
		},
	};

	Object.defineProperty(target, propertyKey, accessor);
	return accessor;
}
