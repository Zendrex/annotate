import type { AnyConstructor } from "./types";

/**
 * Reads `instance.constructor` and validates it is a real class-shaped
 * constructor. Rejects non-object inputs, missing/undefined constructors,
 * non-function constructors, the bare `Object` constructor, and constructors
 * whose `prototype` is not an object — so reflection only runs against
 * user-defined classes.
 *
 * @throws {TypeError} When `instance` fails any of those checks.
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
 * Normalises a reflect target to a class constructor. For function values,
 * applies the constructor-shape checks (rejects `Object`, requires an object
 * prototype) and returns it; otherwise delegates to
 * {@link resolveConstructorFromInstance}.
 *
 * @throws {TypeError} If `target` is not a class-shaped constructor or a
 *   resolvable instance, or if it resolves to `Object`.
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
