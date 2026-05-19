import { getOrCreate } from "../stores/get-or-create";
import { appendMemberMeta } from "../stores/member-meta-store";
import { resolveCtorFromMetadata } from "./ctor-correlation";
import { invalidatePrepared } from "./prepared-sentinel";
import type { Ctor, Deferred, DeferredValidateContext } from "../types";

const pendingByMetadata: WeakMap<object, Deferred[]> = new WeakMap();

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
