import { walkPrototypeChain } from "../runtime/prototype-chain";
import type { Ctor } from "./types";

/**
 * Single trust boundary for the `unknown[] -> readonly T[]` brand laundering
 * the metadata stores rely on. The stored array is `unknown[]`; callers project
 * it to `readonly T[]` based on the brand on a `MetadataKey<T>`. Centralizing
 * the cast keeps every store reader honest about where the assertion happens.
 */
export function readValues<T>(values: unknown[] | undefined): readonly T[] | undefined {
	return values as T[] | undefined;
}

/**
 * Walks the prototype chain of `ctor` (subclass first) and short-circuits at
 * the first link where `probe` reports a hit. Avoids materializing intermediates.
 */
export function chainHasNonEmpty(ctor: Ctor, probe: (current: Ctor) => boolean): boolean {
	let found = false;
	walkPrototypeChain(ctor, (current) => {
		if (probe(current)) {
			found = true;
			return true;
		}
	});
	return found;
}

/**
 * First element of the first non-empty list yielded along the prototype chain of `ctor`
 * (subclass before superclass), or `undefined` if every link is empty or missing.
 */
export function firstOnChain<T>(ctor: Ctor, getList: (current: Ctor) => readonly T[] | undefined): T | undefined {
	let result: T | undefined;
	walkPrototypeChain(ctor, (current) => {
		const list = getList(current);
		if (list && list.length > 0) {
			result = list[0];
			return true;
		}
	});
	return result;
}

/**
 * Concatenates every list yielded along the prototype chain of `ctor` in walk
 * order (subclass first). Empty or missing links are skipped.
 */
export function collectFromChain<T>(ctor: Ctor, getList: (current: Ctor) => readonly T[] | undefined): T[] {
	const out: T[] = [];
	walkPrototypeChain(ctor, (current) => {
		const list = getList(current);
		if (list) {
			for (const item of list) {
				out.push(item);
			}
		}
	});
	return out;
}
