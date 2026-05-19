import { walkPrototypeChain } from "../../runtime/prototype-chain";
import type { Ctor } from "../types";

// Trust boundary: stored values are `unknown[]`; callers project via `MetadataKey<T>`.
export function readValues<T>(values: unknown[] | undefined): readonly T[] | undefined {
	return values as T[] | undefined;
}

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
