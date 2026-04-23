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
	toAccessor,
} from "./shared";
import type { DecoratedPropertyFactory, PropertyGetter, PropertyInterceptorOptions, PropertySetter } from "./types";

/**
 * Create a property decorator that records metadata and wraps access via
 * `onGet` / `onSet`.
 *
 * Data fields are promoted to accessors so the hooks can run; the property is
 * redefined on the declaration target (prototype or constructor). A hook is
 * only invoked when its side of the accessor exists — `onGet` runs when the
 * descriptor has a getter, `onSet` when it has a setter. Supplying neither
 * option is a programmer error and throws `TypeError` at factory creation.
 *
 * @throws {TypeError} When neither `onGet` nor `onSet` is provided
 * @throws {AnnotateError} `code: "duplicate"` when `unique` is set and the slot is decorated twice
 */
export function createPropertyInterceptor<TMeta, TArgs extends unknown[] = [TMeta]>(
	options: PropertyInterceptorOptions<TMeta, TArgs>
): DecoratedPropertyFactory<TMeta, TArgs> {
	if (!(options.onGet || options.onSet)) {
		throw new TypeError("createPropertyInterceptor: provide at least one of onGet or onSet");
	}

	const key = generateKey();
	const { compose: composeFn, onGet, onSet, name, unique } = options;
	const label = labelFor(name, key);

	const decoratorFn =
		(...args: TArgs) =>
		(target: object, propertyKey: string | symbol): void => {
			if (unique && getMetadataArray<TMeta>(key, target, propertyKey).length > 0) {
				throwDuplicateMember(key, "property", normalizeAnnotateErrorTarget(target), propertyKey, label);
			}
			const metadata = appendMetadata(key, target, compose(args, composeFn), propertyKey);

			const descriptor = toAccessor(target, propertyKey);
			const context = { owner: target, name: propertyKey, descriptor };

			if (onGet && descriptor.get) {
				descriptor.get = onGet(descriptor.get as PropertyGetter, metadata, context);
			}
			if (onSet && descriptor.set) {
				descriptor.set = onSet(descriptor.set as PropertySetter, metadata, context);
			}
			Object.defineProperty(target, propertyKey, descriptor);
		};

	return Object.assign(decoratorFn, {
		key,
		reflect: (target: object) => createScopedReflector<TMeta>(resolveReflectTarget(target), key),
		metadata: (target: object, name: string | symbol): TMeta | undefined =>
			lookupMemberMetadataScalar<TMeta>(key, resolveReflectTarget(target), name),
		requireMetadata: (target: object, name: string | symbol): TMeta => {
			const ctor = resolveReflectTarget(target);
			const value = lookupMemberMetadataScalar<TMeta>(key, ctor, name);
			return value === undefined ? throwMissingMember(key, "property", ctor, name, label) : value;
		},
		applied: (target: object, name: string | symbol): boolean =>
			memberMetadataApplied<TMeta>(key, resolveReflectTarget(target), name),
		appliedOwn: (target: object, name: string | symbol): boolean =>
			memberMetadataAppliedOwn<TMeta>(key, resolveReflectTarget(target), name),
	}) as DecoratedPropertyFactory<TMeta, TArgs>;
}
