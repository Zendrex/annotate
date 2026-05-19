import type { Ctor } from "../types";

const fullyPrepared: WeakSet<Ctor> = new WeakSet();

export function isFullyPrepared(ctor: Ctor): boolean {
	return fullyPrepared.has(ctor);
}

export function markFullyPrepared(ctor: Ctor): void {
	fullyPrepared.add(ctor);
}

export function invalidatePrepared(ctor: Ctor): void {
	fullyPrepared.delete(ctor);
}
