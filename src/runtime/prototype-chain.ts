import type { Ctor } from "../metadata/types";

/**
 * Walks the constructor prototype chain for metadata discovery: visits `ctor`,
 * then each `Object.getPrototypeOf` link, until the chain ends or reaches
 * `Function.prototype` (that node is not visited). Stops early when `visit`
 * returns strictly `true`.
 *
 * **Contract:** Used so metadata lookup can consider inherited constructors
 * without walking past the built-in function prototype.
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
