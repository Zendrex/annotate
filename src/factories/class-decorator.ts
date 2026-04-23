import { appendMetadata, getMetadataArray } from "../metadata/store";
import { resolveReflectTarget } from "../reflector/resolve-instance";
import { createScopedReflector } from "../reflector/scoped-reflector";
import {
	classMetadataApplied,
	classMetadataAppliedOwn,
	classMetadataFirst,
	compose,
	generateKey,
	labelFor,
	normalizeAnnotateErrorTarget,
	throwDuplicateClass,
	throwMissingClass,
} from "./shared";
import type { DecoratedClassFactory, DecoratorOptions } from "./types";

export function createClassDecorator<TMeta, TArgs extends unknown[] = [TMeta]>(
	options?: DecoratorOptions<TMeta, TArgs>
): DecoratedClassFactory<TMeta, TArgs> {
	const key = generateKey();
	const { compose: composeFn, name, unique } = options ?? {};
	const label = labelFor(name, key);

	const decoratorFn =
		(...args: TArgs) =>
		(target: object): void => {
			if (unique && getMetadataArray<TMeta>(key, target).length > 0) {
				throwDuplicateClass(key, normalizeAnnotateErrorTarget(target), label);
			}
			appendMetadata(key, target, compose(args, composeFn));
		};

	return Object.assign(decoratorFn, {
		key,
		reflect: (target: object) => createScopedReflector<TMeta>(resolveReflectTarget(target), key),
		applied: (target: object): boolean => classMetadataApplied<TMeta>(key, resolveReflectTarget(target)),
		appliedOwn: (target: object): boolean => classMetadataAppliedOwn<TMeta>(key, resolveReflectTarget(target)),
		metadata: (target: object): TMeta | undefined => classMetadataFirst<TMeta>(key, resolveReflectTarget(target)),
		requireMetadata: (target: object): TMeta => {
			const ctor = resolveReflectTarget(target);
			const first = classMetadataFirst<TMeta>(key, ctor);
			return first === undefined ? throwMissingClass(key, ctor, label) : first;
		},
	}) as DecoratedClassFactory<TMeta, TArgs>;
}
