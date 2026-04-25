import { UnregisteredClassError } from "../errors";
import { getCorrelationFor, registerCtor } from "../metadata/metadata-ctor-correlation";
import { flushFor, hasPendingFor } from "../metadata/metadata-deferred-queue";
import { walkPrototypeChain } from "./prototype-chain";
import { hasOwnMetadata, readOwnMetadata } from "./symbol-metadata";
import type { Ctor } from "../metadata/types";
import type { AnyConstructor } from "../reflector/types";

/**
 * Ensures deferred annotate metadata for `ctor` is registered and flushed so
 * consumers (e.g. reflection) see a consistent correlation.
 *
 * Call before reading metadata for a constructor that may have staged work, or
 * when continuing after class setup where registration might not have run yet.
 *
 * **Side effects:** May call `registerCtor` and `flushFor` on this constructor
 * or an ancestor with pending work, applying queued metadata to the store.
 *
 * @param ctor - Constructor to prepare
 * @throws {UnregisteredClassError} When the constructor has an own
 *   `Symbol.metadata` slot but the value is null or undefined (degraded path:
 *   the key exists without valid correlation data).
 */
export function prepare(ctor: Ctor): void {
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
		throw new UnregisteredClassError(ctor as AnyConstructor);
	}

	walkPrototypeChain(Object.getPrototypeOf(ctor) as Ctor, (current) => {
		if (!hasOwnMetadata(current)) {
			return;
		}
		const correlation = readOwnMetadata(current);
		if (correlation && hasPendingFor(correlation)) {
			registerCtor(current, correlation);
			flushFor(current, correlation);
			return true;
		}
	});
}
