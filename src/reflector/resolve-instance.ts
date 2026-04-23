import type { AnyConstructor } from "./types";

/**
 * Resolve an instance (or prototype) to its concrete constructor, rejecting
 * anything that would degrade reflection (`Object`, missing prototype, etc.).
 * Used when normalizing `AnnotateError.target` and as a helper for
 * {@link resolveReflectTarget}.
 *
 * @throws {TypeError} With a `reflect(target):` message prefix when the argument cannot be resolved.
 */
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

/**
 * Resolve any reflection entry-point argument — a class, prototype, or
 * instance — to the constructor used for metadata lookups.
 *
 * @throws {TypeError} With a stable `reflect(target):` message prefix when the argument is unusable.
 */
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
