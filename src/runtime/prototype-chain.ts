import type { Ctor } from "../metadata/types";

/**
 * Walk `ctor`'s prototype chain, invoking `visit` for each ancestor (including
 * `ctor` itself). Returning `true` from `visit` stops the walk. The walk stops
 * at `Function.prototype` so reflection never reads from the base callable.
 *
 * @internal
 */
export function walkPrototypeChain(ctor: Ctor, visit: (current: Ctor) => unknown): void {
	let current: Ctor | null = ctor;
	while (current && current !== Function.prototype) {
		if (visit(current) === true) {
			return;
		}
		current = Object.getPrototypeOf(current) as Ctor | null;
	}
}
