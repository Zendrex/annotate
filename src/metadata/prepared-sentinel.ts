import { resolveCtorFromMetadata } from "./metadata-ctor-correlation";
import type { Ctor } from "./types";

/**
 * Tracks constructors whose deferred metadata has been fully drained so subsequent
 * `prepare(ctor)` calls can short-circuit. The hot path (reader helpers calling
 * `prepare` on every `.first()`/`.has()`/`.all()`) collapses to a single WeakSet
 * lookup once the ctor is marked.
 *
 * The sentinel is invalidated whenever new deferred work is queued for a
 * correlation that already has a resolved ctor; `prepare` will then re-walk
 * and re-flush, restoring the mark on success.
 */
const fullyPrepared: WeakSet<Ctor> = new WeakSet();

/**
 * True if `prepare(ctor)` has previously completed without pending work and no
 * subsequent enqueue has invalidated that state.
 */
export function isFullyPrepared(ctor: Ctor): boolean {
	return fullyPrepared.has(ctor);
}

/**
 * Marks `ctor` as fully prepared. Call only after `prepare` has successfully
 * drained all pending work for the ctor and its ancestor chain.
 */
export function markFullyPrepared(ctor: Ctor): void {
	fullyPrepared.add(ctor);
}

/**
 * Drops the fully-prepared mark for the ctor (if any) registered against this
 * correlation. Called from `queueDeferred` so that fresh deferred work forces
 * the next `prepare` call to re-walk and re-flush.
 *
 * No-op when the correlation has no registered ctor yet (typical case: decorators
 * run before `addInitializer` registers the real class).
 */
export function invalidatePreparedFor(correlation: object): void {
	const ctor = resolveCtorFromMetadata(correlation);
	if (ctor) {
		fullyPrepared.delete(ctor);
	}
}
