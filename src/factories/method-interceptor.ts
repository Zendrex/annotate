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
import type { DecoratedMethodFactory, MethodInterceptorOptions } from "./types";

export function createMethodInterceptor<TMeta, TArgs extends unknown[] = [TMeta]>(
	options: MethodInterceptorOptions<TMeta, TArgs>
): DecoratedMethodFactory<TMeta, TArgs> {
	const key = generateKey();
	const { compose: composeFn, intercept, name, unique } = options;
	const label = labelFor(name, key);

	const decoratorFn =
		(...args: TArgs) =>
		(target: object, propertyKey: string | symbol, descriptor?: PropertyDescriptor): void => {
			if (unique && getMetadataArray<TMeta>(key, target, propertyKey).length > 0) {
				throwDuplicateMember(key, "method", normalizeAnnotateErrorTarget(target), propertyKey, label);
			}
			const metadata = appendMetadata(key, target, compose(args, composeFn), propertyKey);

			if (!descriptor || typeof descriptor.value !== "function") {
				return;
			}
			const original = descriptor.value;
			const wrapped = intercept(original, metadata, {
				owner: target,
				name: propertyKey,
				descriptor,
			});

			Object.defineProperty(wrapped, "name", {
				value: original.name,
				configurable: true,
			});
			descriptor.value = wrapped;
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
