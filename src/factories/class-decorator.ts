import { appendClassMeta, flushFor, registerCtor } from "../metadata/store";
import { compose, createClassFactoryHelpers, generateKey, labelFor } from "./shared";
import type { DecoratedClassFactory, DecoratorOptions } from "./types";

/**
 * Create a typed class decorator with reflection helpers pre-bound to a unique
 * metadata key. `TInstance` constrains the class the decorator may apply to —
 * narrowing it (e.g. to `Component`) rejects applications to classes whose
 * instances do not extend the bound at compile time.
 */
export function createClassDecorator<TMeta, TArgs extends unknown[] = [TMeta], TInstance = unknown>(
	options?: DecoratorOptions<TMeta, TArgs>
): DecoratedClassFactory<TMeta, TArgs, TInstance> {
	const key = generateKey(options?.name);
	const { compose: composeFn, name, unique = false } = options ?? {};
	const label = labelFor(name, key);

	const decoratorFn =
		(...args: TArgs) =>
		// biome-ignore lint/suspicious/noExplicitAny: structural Stage-3 generic
		<T extends abstract new (...a: any[]) => TInstance>(value: T, context: ClassDecoratorContext<T>): void => {
			appendClassMeta(value, key, compose(args, composeFn), { unique });
			registerCtor(value, context.metadata);
			flushFor(value, context.metadata);
		};

	return Object.assign(decoratorFn, {
		key,
		...createClassFactoryHelpers<TMeta>(key, label),
	}) as DecoratedClassFactory<TMeta, TArgs, TInstance>;
}
