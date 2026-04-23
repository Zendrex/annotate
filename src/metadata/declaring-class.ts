import { hasOwnMetadata, readOwnMetadata } from "../runtime/symbol-metadata";

// biome-ignore lint/complexity/noBannedTypes: Constructor identity uses Function for parity with runtime/symbol-metadata.
type Ctor = Function;

/**
 * Walk the constructor prototype chain from `instance.constructor` upward,
 * returning the first ancestor whose **own** `[Symbol.metadata]` matches
 * `correlation`. Falls back to `instance.constructor` when `correlation` is
 * nullish or unmatched.
 *
 * The own-bag check (`hasOwnMetadata`) is essential: tslib installs each class's
 * metadata bag as `Object.create(super[Symbol.metadata])`, so an inherited-only
 * read leaks the parent's bag through `ctor[Symbol.metadata]`. Without the
 * guard, `class B extends A {}` (no decorations on B) would match A's
 * correlation at the B link and return B incorrectly.
 */
export function resolveDeclaringClass(instance: object, correlation: object | null): Ctor {
	const start = (instance as { constructor: Ctor }).constructor;
	if (!correlation) {
		return start;
	}
	let ctor: Ctor | null = start;
	while (ctor && ctor !== Function.prototype) {
		if (hasOwnMetadata(ctor) && readOwnMetadata(ctor) === correlation) {
			return ctor;
		}
		ctor = Object.getPrototypeOf(ctor) as Ctor | null;
	}
	return start;
}
