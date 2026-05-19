import { UnregisteredClassError } from "../errors";
import { getCorrelationFor, registerCtor } from "../metadata/pipeline/ctor-correlation";
import { flushFor, hasPendingFor } from "../metadata/pipeline/deferred-queue";
import { isFullyPrepared, markFullyPrepared } from "../metadata/pipeline/prepared-sentinel";
import { walkPrototypeChain } from "./prototype-chain";
import { hasOwnMetadata, readOwnMetadata } from "./symbol-metadata";
import type { Ctor } from "../metadata/types";
import type { AnyConstructor } from "../reflector/types";

/**
 * Registers `ctor` (or the first ancestor with pending work) and drains queued
 * deferred decorations before reflection.
 */
export function prepare(ctor: Ctor): void {
	// Short-circuit: nothing to do if this ctor was already drained and no new
	// deferred work has been queued since (the sentinel is invalidated on
	// `queueDeferred`).
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

	// Chain-walk fallback (rare): `ctor` has no own metadata slot, but an
	// ancestor may have pending deferred work. Walk until we find one and flush
	// it. Do NOT mark `ctor` fully prepared here — the walk stops at the first
	// hit, and further ancestors may still hold pending work for later calls.
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
