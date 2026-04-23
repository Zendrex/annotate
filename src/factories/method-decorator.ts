import { appendMetadata, getMetadataArray } from "../metadata/store";
import { resolveReflectTarget } from "../reflector/resolve-instance";
import { createScopedReflector } from "../reflector/scoped-reflector";
import {
	compose,
	generateKey,
	labelFor,
	lookupMemberMetadataScalar,
	memberMetadataApplied,
	memberMetadataAppliedOwn,
	normalizeAnnotateErrorTarget,
	throwDuplicateMember,
	throwMissingMember,
} from "./shared";
import type { DecoratedMethodFactory, DecoratorOptions } from "./types";

/**
 * Create a typed method decorator factory with a unique metadata key and
 * reflection helpers scoped to methods.
 *
 * Metadata is stored per method property key and appended per application.
 * `unique` constrains each (class, method) slot to a single application; a
 * second application throws {@link AnnotateError} with `code: "duplicate"`.
 *
 * Static and instance methods are stored independently; reflection returns
 * both with a `static` flag.
 *
 * @throws {AnnotateError} `code: "duplicate"` when `unique` is set and the same slot is decorated twice
 */
export function createMethodDecorator<TMeta, TArgs extends unknown[] = [TMeta]>(
	options?: DecoratorOptions<TMeta, TArgs>
): DecoratedMethodFactory<TMeta, TArgs> {
	const key = generateKey();
	const { compose: composeFn, name, unique } = options ?? {};
	const label = labelFor(name, key);

	const decoratorFn =
		(...args: TArgs) =>
		(target: object, propertyKey: string | symbol): void => {
			if (unique && getMetadataArray<TMeta>(key, target, propertyKey).length > 0) {
				throwDuplicateMember(key, "method", normalizeAnnotateErrorTarget(target), propertyKey, label);
			}
			appendMetadata(key, target, compose(args, composeFn), propertyKey);
		};

	return Object.assign(decoratorFn, {
		key,
		reflect: (target: object) => createScopedReflector<TMeta>(resolveReflectTarget(target), key),
		metadata: (target: object, name: string | symbol): TMeta | undefined =>
			lookupMemberMetadataScalar<TMeta>(key, resolveReflectTarget(target), name),
		requireMetadata: (target: object, name: string | symbol): TMeta => {
			const ctor = resolveReflectTarget(target);
			const value = lookupMemberMetadataScalar<TMeta>(key, ctor, name);
			return value === undefined ? throwMissingMember(key, "method", ctor, name, label) : value;
		},
		applied: (target: object, name: string | symbol): boolean =>
			memberMetadataApplied<TMeta>(key, resolveReflectTarget(target), name),
		appliedOwn: (target: object, name: string | symbol): boolean =>
			memberMetadataAppliedOwn<TMeta>(key, resolveReflectTarget(target), name),
	}) as DecoratedMethodFactory<TMeta, TArgs>;
}
