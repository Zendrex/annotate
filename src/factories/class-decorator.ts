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

/**
 * Create a typed class decorator factory with a unique metadata key and
 * pre-bound reflection helpers.
 *
 * The returned decorator appends metadata per application so later decorators
 * at the same site add to the array rather than overwriting. When
 * `options.unique` is set, a second application on the same class throws
 * {@link AnnotateError} with `code: "duplicate"`.
 *
 * Reflection via `metadata` / `applied` walks the prototype chain; use
 * `appliedOwn` / `metadata(Subclass)` with awareness that subclasses inherit
 * parent decorations.
 *
 * @typeParam TMeta - Metadata stored per application
 * @typeParam TArgs - Arguments accepted by the decorator call; defaults to `[TMeta]`
 * @throws {AnnotateError} `code: "duplicate"` on a second application when `unique` is set
 * @throws {AnnotateError} `code: "missing"` from `requireMetadata` when no metadata is present
 */
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
