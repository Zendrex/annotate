import { appendClassMeta, collectClassMeta, flushFor, hasOwnClassMeta, registerCtor } from "../metadata/store";
import { resolveReflectTarget } from "../reflector/resolve-instance";
import { createScopedReflector } from "../reflector/scoped-reflector";
import { materialize } from "../runtime/materialize";
import { compose, generateKey, labelFor, throwMissingClass } from "./shared";
import type { DecoratedClassFactory, DecoratorOptions } from "./types";

// biome-ignore lint/complexity/noBannedTypes: Constructor identity uses Function for parity with metadata/store module.
type Ctor = Function;

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

	const firstClassMeta = (ctor: Ctor): TMeta | undefined => {
		const list = collectClassMeta<TMeta>(ctor, key);
		return list.length > 0 ? list[0] : undefined;
	};

	return Object.assign(decoratorFn, {
		key,
		reflect: (target: object) => createScopedReflector<TMeta>(resolveReflectTarget(target), key),
		metadata: (target: object) => {
			const ctor = resolveReflectTarget(target);
			materialize(ctor);
			return firstClassMeta(ctor);
		},
		requireMetadata: (target: object): TMeta => {
			const ctor = resolveReflectTarget(target);
			materialize(ctor);
			const first = firstClassMeta(ctor);
			return first === undefined ? throwMissingClass(key, ctor, label) : first;
		},
		applied: (target: object) => {
			const ctor = resolveReflectTarget(target);
			materialize(ctor);
			return collectClassMeta<TMeta>(ctor, key).length > 0;
		},
		appliedOwn: (target: object) => {
			const ctor = resolveReflectTarget(target);
			materialize(ctor);
			return hasOwnClassMeta(ctor, key);
		},
	}) as DecoratedClassFactory<TMeta, TArgs, TInstance>;
}
