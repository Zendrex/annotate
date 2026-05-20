import type { Ctor } from "../metadata/types";

// Stops before `Function.prototype` so walks stay inside user-defined constructors.
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
