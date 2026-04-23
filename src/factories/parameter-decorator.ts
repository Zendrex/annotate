import { getParameterMap, setParameterMap } from "../metadata/store";
import { resolveReflectTarget } from "../reflector/resolve-instance";
import { createScopedReflector } from "../reflector/scoped-reflector";
import {
	compose,
	generateKey,
	labelFor,
	lookupParameterMetadata,
	parameterMetadataApplied,
	parameterMetadataAppliedOwn,
	throwMissingParameter,
} from "./shared";
import type { DecoratedParameterFactory, ParameterDecoratorOptions } from "./types";

export function createParameterDecorator<TMeta, TArgs extends unknown[] = [TMeta]>(
	options?: ParameterDecoratorOptions<TMeta, TArgs>
): DecoratedParameterFactory<TMeta, TArgs> {
	const key = generateKey();
	const { compose: composeFn, name } = options ?? {};
	const label = labelFor(name, key);

	const decoratorFn =
		(...args: TArgs) =>
		(target: object, propertyKey: string | symbol | undefined, parameterIndex: number): void => {
			const map = getParameterMap<TMeta>(key, target, propertyKey);
			const existing = map.get(parameterIndex) ?? [];
			existing.push(compose(args, composeFn));
			map.set(parameterIndex, existing);
			setParameterMap(key, target, map, propertyKey);
		};

	return Object.assign(decoratorFn, {
		key,
		reflect: (target: object) => createScopedReflector<TMeta>(resolveReflectTarget(target), key),
		metadata: (target: object, parameterIndex: number, methodName?: string | symbol): TMeta | undefined =>
			lookupParameterMetadata<TMeta>(key, resolveReflectTarget(target), parameterIndex, methodName),
		requireMetadata: (target: object, parameterIndex: number, methodName?: string | symbol): TMeta => {
			const ctor = resolveReflectTarget(target);
			const value = lookupParameterMetadata<TMeta>(key, ctor, parameterIndex, methodName);
			return value === undefined ? throwMissingParameter(key, ctor, parameterIndex, label, methodName) : value;
		},
		applied: (target: object, parameterIndex: number, methodName?: string | symbol): boolean =>
			parameterMetadataApplied<TMeta>(key, resolveReflectTarget(target), parameterIndex, methodName),
		appliedOwn: (target: object, parameterIndex: number, methodName?: string | symbol): boolean =>
			parameterMetadataAppliedOwn<TMeta>(key, resolveReflectTarget(target), parameterIndex, methodName),
	}) as DecoratedParameterFactory<TMeta, TArgs>;
}
