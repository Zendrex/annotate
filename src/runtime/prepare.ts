import { UnregisteredClassError } from "../errors";
import { getCorrelationFor, registerCtor } from "../metadata/metadata-ctor-correlation";
import { flushFor, hasPendingFor } from "../metadata/metadata-deferred-queue";
import { isFullyPrepared, markFullyPrepared } from "../metadata/prepared-sentinel";
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
	// Hot-path short-circuit: if we have already drained this ctor and no new
	// deferred work has been enqueued (sentinel invalidated on `queueDeferred`),
	// there is nothing to do.
	if (isFullyPrepared(ctor)) {
		return;
	}

	const cached = getCorrelationFor(ctor);
	if (cached) {
		flushFor(ctor, cached);
		markFullyPrepared(ctor);
		return;
	}

	if (hasOwnMetadata(ctor)) {
		const own = readOwnMetadata(ctor);
		if (own) {
			registerCtor(ctor, own);
			flushFor(ctor, own);
			markFullyPrepared(ctor);
			return;
		}
		throw new UnregisteredClassError(ctor as AnyConstructor);
	}

	// Chain-walk fallback (rare): the ctor itself has no own metadata slot, but
	// an ancestor may have pending deferred work. Walk until we find one and
	// flush it. We do NOT mark `ctor` fully prepared here because the walk stops
	// at the first hit; further ancestors may still hold pending work to drain
	// on subsequent calls (preserves the historical contract of this branch).
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
