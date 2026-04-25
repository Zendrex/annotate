import type { AnyConstructor } from "./types";

/**
 * Obtains the class constructor from an **instance** by reading `instance.constructor`.
 *
 * Rejects plain `Object` results and values that are not ordinary constructors with an object
 * prototype, so reflection stays tied to real class-shaped targets.
 *
 * @param instance - Object instance whose prototype chain should yield a usable constructor
 * @returns The instance’s class constructor
 * @throws {TypeError} If the value is not a non-null object, has no usable `constructor`, the
 *   constructor is `Object`, or the constructor lacks a non-null object `prototype`
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
 * Normalizes a **reflect** target to a {@link AnyConstructor}.
 *
 * Pass a class constructor directly, or an instance (resolved via
 * {@link resolveConstructorFromInstance}). This is the shared resolution path for the
 * `reflect()` function in `./reflector.ts`.
 *
 * @param target - A class constructor or an instance object
 * @returns The constructor to use for metadata lookup
 * @throws {TypeError} If `target` is not a constructor or instance that satisfies the same
 *   constraints as {@link resolveConstructorFromInstance}, or if the constructor is `Object`
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
