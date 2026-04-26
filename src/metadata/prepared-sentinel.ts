import type { Ctor } from "./types";

/**
 * Tracks constructors whose deferred metadata has been fully drained so subsequent
 * `prepare(ctor)` calls can short-circuit. The hot path (reader helpers calling
 * `prepare` on every `.first()`/`.has()`/`.all()`) collapses to a single WeakSet
 * lookup once the ctor is marked.
 *
 * The sentinel is invalidated whenever new deferred work is queued for a ctor
 * that has already been marked; `prepare` then re-walks and re-flushes,
 * restoring the mark on success.
 */
const fullyPrepared: WeakSet<Ctor> = new WeakSet();

/** True if `prepare(ctor)` has previously completed without pending work and no subsequent enqueue has invalidated that state. */
export function isFullyPrepared(ctor: Ctor): boolean {
	return fullyPrepared.has(ctor);
}

/** Marks `ctor` as fully prepared. Call only after `prepare` drained all pending work for the ctor and its ancestor chain. */
export function markFullyPrepared(ctor: Ctor): void {
	fullyPrepared.add(ctor);
}

/** Drops the fully-prepared mark for `ctor` (if any). No-op when not currently marked. */
export function invalidatePrepared(ctor: Ctor): void {
	fullyPrepared.delete(ctor);
}
