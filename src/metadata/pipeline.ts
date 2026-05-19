import { UnregisteredClassError } from "../errors";
import { walkPrototypeChain } from "../runtime/prototype-chain";
import { hasOwnMetadata, readOwnMetadata } from "../runtime/symbol-metadata";
import { appendMemberMeta, getOrCreate } from "./store";
import type { AnyConstructor } from "../reflector/types";
import type { Ctor, Deferred, DeferredValidateContext } from "./types";

const fullyPrepared: WeakSet<Ctor> = new WeakSet();
const metadataToCtor: WeakMap<object, Ctor> = new WeakMap();
const ctorToMetadata = new WeakMap<Ctor, object>();
const pendingByMetadata: WeakMap<object, Deferred[]> = new WeakMap();

export function isFullyPrepared(ctor: Ctor): boolean {
	return fullyPrepared.has(ctor);
}

export function markFullyPrepared(ctor: Ctor): void {
	fullyPrepared.add(ctor);
}

export function invalidatePrepared(ctor: Ctor): void {
	fullyPrepared.delete(ctor);
}

export function registerCtor(ctor: Ctor, correlation: object | null): void {
	if (!correlation) {
		return;
	}
	const existingCtor = metadataToCtor.get(correlation);
	if (existingCtor !== undefined && existingCtor !== ctor) {
		throw new Error(
			"registerCtor: correlation is already bound to a different constructor. " +
				"This indicates the same metadata bag was registered against two classes."
		);
	}
	const existingCorrelation = ctorToMetadata.get(ctor);
	if (existingCorrelation !== undefined && existingCorrelation !== correlation) {
		throw new Error(
			"registerCtor: constructor is already bound to a different correlation. " +
				"This indicates a decorator-pipeline registered two metadata bags against one class."
		);
	}
	if (existingCtor === undefined) {
		metadataToCtor.set(correlation, ctor);
	}
	if (existingCorrelation === undefined) {
		ctorToMetadata.set(ctor, correlation);
	}
}

export function resolveCtorFromMetadata(correlation: object): Ctor | undefined {
	return metadataToCtor.get(correlation);
}

export function getCorrelationFor(ctor: Ctor): object | undefined {
	return ctorToMetadata.get(ctor);
}

function runValidators(entry: Deferred, ctor: Ctor): void {
	if (!entry.validators || entry.validators.length === 0) {
		return;
	}
	const context: DeferredValidateContext = {
		target: ctor,
		memberName: entry.name,
		kind: entry.kind,
		static: entry.static,
	};
	for (const validator of entry.validators) {
		validator(entry.meta, context);
	}
}

export function queueDeferred(correlation: object | null, deferred: Deferred): void {
	if (!correlation) {
		return;
	}
	const list = getOrCreate(pendingByMetadata, correlation, () => []);
	list.push(deferred);
	// Any new deferred work invalidates the "fully prepared" sentinel for the
	// resolved ctor (if registered) so the next `prepare` re-walks and flushes.
	const ctor = resolveCtorFromMetadata(correlation);
	if (ctor) {
		invalidatePrepared(ctor);
	}
}

export function hasPendingFor(correlation: object): boolean {
	const list = pendingByMetadata.get(correlation);
	return !!list && list.length > 0;
}

export function flushFor(ctor: Ctor, correlation: object | null): void {
	if (!correlation) {
		return;
	}
	const list = pendingByMetadata.get(correlation);
	if (!list) {
		return;
	}
	let index = 0;
	try {
		for (; index < list.length; index++) {
			const entry = list[index] as Deferred;
			runValidators(entry, ctor);
			appendMemberMeta(ctor, entry.key, entry.name, entry.meta, entry.token, {
				static: entry.static,
				kind: entry.kind,
			});
		}
	} catch (error) {
		// Re-queue from the failing index onward; already-appended items stay stored.
		pendingByMetadata.set(correlation, list.slice(index));
		throw error;
	}
	pendingByMetadata.delete(correlation);
}

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
