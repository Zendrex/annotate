import { appendMemberMeta } from "./member-meta-store";
import type { Ctor, Deferred, DeferredValidateContext } from "./types";

const pendingByMetadata: WeakMap<object, Deferred[]> = new WeakMap();

/**
 * Stages member metadata until ctor correlation is registered. Uses the same `correlation`
 * object as `registerCtor` so decorators that run before the final class exist can still
 * record work; `flushFor` replays the queue into `appendMemberMeta` when the real `Ctor` is known.
 *
 * No-op if `correlation` is null.
 */
export function queueDeferred(correlation: object | null, deferred: Deferred): void {
	if (!correlation) {
		return;
	}
	let list = pendingByMetadata.get(correlation);
	if (!list) {
		list = [];
		pendingByMetadata.set(correlation, list);
	}
	list.push(deferred);
}

/**
 * True if there is a non-empty pending list for this correlation (metadata not yet flushed or failed mid-flush).
 */
export function hasPendingFor(correlation: object): boolean {
	return pendingByMetadata.has(correlation);
}

/**
 * Drains the deferred list for `correlation` into the member store for `ctor`: runs
 * optional validators, then `appendMemberMeta` in order. On success, removes the queue.
 *
 * If a validator or `appendMemberMeta` throws, entries from the failed index onward stay
 * queued (already committed entries are not rolled back; tokens prevent double-append on retry).
 *
 * @param ctor - The resolved class constructor; must match the ctor registered for this `correlation`
 * @param correlation - The same object identity used with `queueDeferred` / `registerCtor`
 */
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
			const d = list[index] as Deferred;
			if (d.validators && d.validators.length > 0) {
				const context: DeferredValidateContext = {
					target: ctor,
					memberName: d.name,
					kind: d.kind,
					static: d.static,
				};
				for (const validator of d.validators) {
					validator(d.meta, context);
				}
			}
			appendMemberMeta(ctor, d.key, d.name, d.meta, d.token, {
				unique: d.unique,
				static: d.static,
				kind: d.kind,
			});
		}
	} catch (error) {
		// Re-queue from the failing index onward; already-appended items stay stored.
		pendingByMetadata.set(correlation, list.slice(index));
		throw error;
	}
	pendingByMetadata.delete(correlation);
}
