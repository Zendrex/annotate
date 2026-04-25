import type { Ctor } from "./types";

const metadataToCtor: WeakMap<object, Ctor> = new WeakMap();
const ctorToMetadata = new WeakMap<Ctor, object>();

/**
 * Links a stable “metadata correlation” object to a `Ctor` as soon as both are known.
 * Decorators on transpiled class bodies often see a placeholder class before the real
 * constructor exists; the correlation id lets deferred metadata queue against one object
 * and later register the actual `Ctor` without duplicating work.
 *
 * No-op if `correlation` is null. First wins: existing mappings for `correlation` or `ctor` are not overwritten.
 *
 * @param ctor - The runtime class constructor
 * @param correlation - Object identity used to tie queued metadata to this ctor (from the same class declaration)
 */
export function registerCtor(ctor: Ctor, correlation: object | null): void {
	if (!correlation) {
		return;
	}
	if (!metadataToCtor.has(correlation)) {
		metadataToCtor.set(correlation, ctor);
	}
	if (!ctorToMetadata.has(ctor)) {
		ctorToMetadata.set(ctor, correlation);
	}
}

/**
 * Resolves the constructor last registered for this correlation, if any.
 * Used when flushing deferred member metadata to find the `Ctor` to store under.
 */
export function resolveCtorFromMetadata(correlation: object): Ctor | undefined {
	return metadataToCtor.get(correlation);
}

/**
 * Returns the correlation object associated with this constructor, if one was registered.
 * Inverse of `resolveCtorFromMetadata` for code that has the `Ctor` and needs the id used while deferred.
 */
export function getCorrelationFor(ctor: Ctor): object | undefined {
	return ctorToMetadata.get(ctor);
}
