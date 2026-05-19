import type { Ctor } from "../types";

const metadataToCtor: WeakMap<object, Ctor> = new WeakMap();
const ctorToMetadata = new WeakMap<Ctor, object>();

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
