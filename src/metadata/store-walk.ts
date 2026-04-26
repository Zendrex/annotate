import { walkPrototypeChain } from "../runtime/prototype-chain";
import type { Ctor } from "./types";

/**
 * Walks the prototype chain of `ctor` and returns `true` as soon as `probe`
 * reports a non-empty hit on any link. Used by the metadata stores to answer
 * "does anything in this chain have data" without materializing intermediates.
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
 * First value produced by walking the prototype chain of `ctor` (subclass before
 * superclass). Returns the first item of the first non-empty list yielded by
 * `getList`, or `undefined` if every link is empty or missing.
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
 * Concatenates every list yielded by `getList` along the prototype chain of `ctor`,
 * in walk order (subclass first). Empty or missing links are skipped.
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
