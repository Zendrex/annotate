import { hasOwnMetadata, readOwnMetadata } from "../runtime/symbol-metadata";
import type { Ctor } from "./types";

/**
 * Find the ancestor on `instance`'s prototype chain whose decoration produced
 * `correlation`. Falls back to `instance.constructor` when `correlation` is
 * nullish or unmatched.
 */
export function resolveDeclaringClass(instance: object, correlation: object | null): Ctor {
	const start = (instance as { constructor: Ctor }).constructor;
	if (!correlation) {
		return start;
	}
	let ctor: Ctor | null = start;
	while (ctor && ctor !== Function.prototype) {
		// Own-bag check is load-bearing: tslib installs each class's metadata as
		// `Object.create(super[Symbol.metadata])`, so inherited reads would leak the
		// parent's correlation through a subclass that has no decorations of its own.
		if (hasOwnMetadata(ctor) && readOwnMetadata(ctor) === correlation) {
			return ctor;
		}
		ctor = Object.getPrototypeOf(ctor) as Ctor | null;
	}
	return start;
}
