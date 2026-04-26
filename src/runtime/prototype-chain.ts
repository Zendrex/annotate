import type { Ctor } from "../metadata/types";

/**
 * Visits `ctor` and each `Object.getPrototypeOf` ancestor until the chain ends
 * or reaches `Function.prototype` (excluded). Returning `true` from `visit`
 * stops the walk early. Stopping at `Function.prototype` keeps metadata
 * discovery inside the user-defined constructor chain.
 */
// biome-ignore lint/suspicious/noConfusingVoidType: visit can return true to stop the walk
export function walkPrototypeChain(ctor: Ctor, visit: (current: Ctor) => boolean | void): void {
	let current: Ctor | null = ctor;
	while (current && current !== Function.prototype) {
		if (visit(current) === true) {
			return;
		}
		current = Object.getPrototypeOf(current) as Ctor | null;
	}
}
