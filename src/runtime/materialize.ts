import { UnregisteredClassError } from "../errors";
import { flushFor, getCorrelationFor, hasPendingFor, registerCtor } from "../metadata/store";
import { hasOwnMetadata, readOwnMetadata } from "./symbol-metadata";

// biome-ignore lint/complexity/noBannedTypes: Constructor identity uses Function for parity with store/declaring-class modules.
type Ctor = Function;

/**
 * Force commit of any pending instance-member registrations for `ctor` so
 * `Factory.reflect(ctor)` / `Factory.applied(ctor, ...)` see them without
 * requiring instantiation.
 *
 * Lookup priority for the correlation object:
 *
 * 1. Cached `ctorToMetadata` entry (populated by any prior eager touch).
 * 2. The class's own `[Symbol.metadata]` (transpiler-installed on TS ≥ 5.2,
 *    Babel `2023-05`, SWC Stage-3).
 * 3. Walk `Object.getPrototypeOf(ctor)` for an ancestor with own
 *    `[Symbol.metadata]` matching a pending slot — lets a subclass flush a
 *    parent's pending Deferreds when the parent was never eagerly touched.
 *
 * No-op when none of the above resolves a correlation. After flush, caches the
 * `ctor ↔ correlation` mapping so subsequent calls short-circuit.
 *
 * @throws {UnregisteredClassError} If the class has an own `[Symbol.metadata]`
 * slot but its value is `undefined` — this indicates a broken transpile (the
 * slot was installed by a decorator-runtime but never populated, which would
 * also fail silently downstream).
 */
export function materialize(ctor: Ctor): void {
	const cached = getCorrelationFor(ctor);
	if (cached) {
		flushFor(ctor, cached);
		return;
	}

	if (hasOwnMetadata(ctor)) {
		const own = readOwnMetadata(ctor);
		if (own) {
			registerCtor(ctor, own);
			flushFor(ctor, own);
			return;
		}
		// Own slot exists but value is null/undefined — degraded-path signal.
		throw new UnregisteredClassError(ctor as new (...args: unknown[]) => unknown);
	}

	let current: Ctor | null = Object.getPrototypeOf(ctor) as Ctor | null;
	while (current && current !== Function.prototype) {
		if (hasOwnMetadata(current)) {
			const correlation = readOwnMetadata(current);
			if (correlation && hasPendingFor(correlation)) {
				registerCtor(current, correlation);
				flushFor(current, correlation);
				return;
			}
		}
		current = Object.getPrototypeOf(current) as Ctor | null;
	}
}
