import { InvalidSelectorError } from "../errors";
import type { AnyConstructor } from "../reflector/types";

export function resolveSelector(target: AnyConstructor, selector: (target: never) => unknown): string | symbol {
	const reads: (string | symbol)[] = [];
	let invoked = false;
	const memberProxy = new Proxy(() => undefined, {
		apply() {
			invoked = true;
			return;
		},
		get(_target, property) {
			reads.push(property);
			return memberProxy;
		},
	});
	const root = new Proxy(Object.create(null), {
		get(_target, property) {
			reads.push(property);
			return memberProxy;
		},
	});

	selector(root as never);

	if (invoked) {
		throw new InvalidSelectorError(target, "selectors must read a member, not invoke it");
	}
	if (reads.length !== 1) {
		throw new InvalidSelectorError(target, "selectors must read exactly one member");
	}
	return reads[0] as string | symbol;
}
