import type { AnyConstructor } from "./types";

export function targetDisplayName(ctor: AnyConstructor): string {
	return typeof ctor.name === "string" && ctor.name.length > 0 ? ctor.name : "<anonymous>";
}

export function formatSlot(target: AnyConstructor, memberName?: string | symbol): string {
	const className = targetDisplayName(target);
	return memberName === undefined ? className : `${className}.${String(memberName)}`;
}

/** Validates `instance.constructor` is a user-defined, class-shaped constructor. */
export function resolveConstructorFromInstance(instance: object): AnyConstructor {
	if (instance === null || typeof instance !== "object") {
		throw new TypeError("reflect(target): object has no resolvable constructor");
	}
	if (!("constructor" in instance) || (instance as { constructor?: unknown }).constructor === undefined) {
		throw new TypeError("reflect(target): object has no resolvable constructor");
	}
	const ctor = (instance as { constructor?: unknown }).constructor;
	if (typeof ctor !== "function" || (ctor as { prototype?: unknown }).prototype === undefined) {
		throw new TypeError("reflect(target): object has no resolvable constructor");
	}
	if (ctor === Object) {
		throw new TypeError("reflect(target): must not use Object or resolve to the Object constructor");
	}
	const proto = (ctor as { prototype?: unknown }).prototype;
	if (typeof proto !== "object" || proto === null) {
		throw new TypeError("reflect(target): function target must have an object prototype");
	}
	return ctor as AnyConstructor;
}

/** Normalises a reflect target to a class constructor (function or instance). */
export function resolveReflectTarget(target: unknown): AnyConstructor {
	if (typeof target === "function") {
		if (target === Object) {
			throw new TypeError("reflect(target): must not use Object or resolve to the Object constructor");
		}
		const proto = (target as { prototype?: unknown }).prototype;
		if (typeof proto !== "object" || proto === null) {
			throw new TypeError("reflect(target): function target must have an object prototype");
		}
		return target as AnyConstructor;
	}
	if (target === null || typeof target !== "object") {
		throw new TypeError("reflect(target): object has no resolvable constructor");
	}
	return resolveConstructorFromInstance(target);
}
