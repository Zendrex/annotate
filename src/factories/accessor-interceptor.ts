import { collectMemberMeta } from "../metadata/store";
import { compose, createMemberFactoryHelpers, emitMemberDecoration, generateKey, labelFor } from "./shared";
import type { Ctor } from "../metadata/types";
import type { AccessorInterceptorOptions, DecoratedAccessorFactory, InterceptorContext } from "./types";

/**
 * Create an accessor (get/set) interceptor. Supply `onGet`, `onSet`, or both;
 * calling with neither throws a `TypeError`. Each hook receives a
 * `readMetadata` reader that, when called at invocation time, returns the
 * full ancestor-merged metadata array for the decorated member.
 *
 * `TValue` constrains the accessor's declared type — narrowing it (e.g.
 * `number`) rejects applications to accessors with incompatible types at
 * compile time.
 *
 * Applies to both instance and static accessors. For instance accessors the
 * metadata registers lazily on first instantiation; static applications
 * register at class-body evaluation and drain the pending buffer.
 */
export function createAccessorInterceptor<TMeta, TArgs extends unknown[] = [TMeta], TValue = unknown>(
	options: AccessorInterceptorOptions<TMeta, TArgs, TValue>
): DecoratedAccessorFactory<TMeta, TArgs, TValue> {
	if (!(options.onGet || options.onSet)) {
		throw new TypeError("createAccessorInterceptor: provide at least one of onGet or onSet");
	}

	const key = generateKey(options.name);
	const { compose: composeFn, onGet, onSet, name, unique = false } = options;
	const label = labelFor(name, key);

	const decoratorFn =
		(...args: TArgs) =>
		(
			// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
			value: ClassAccessorDecoratorTarget<any, TValue>,
			// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
			context: ClassAccessorDecoratorContext<any, TValue>
			// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
		): ClassAccessorDecoratorResult<any, TValue> => {
			const memberName = context.name;
			const isStatic = context.static;

			const interceptorContext: InterceptorContext = {
				name: memberName,
				static: isStatic,
				kind: "accessor",
			};

			const readMetadata = (instance: object): TMeta[] => {
				const ctor = isStatic ? (instance as unknown as Ctor) : (instance as { constructor: Ctor }).constructor;
				return collectMemberMeta<TMeta>(ctor, key, memberName);
			};

			// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
			const result: ClassAccessorDecoratorResult<any, TValue> = {};
			if (onGet) {
				result.get = onGet(value.get, readMetadata, interceptorContext);
			}
			if (onSet) {
				result.set = onSet(value.set, readMetadata, interceptorContext);
			}

			emitMemberDecoration({
				context,
				key,
				// Auto-accessors classify as fields in the store (parity with reflector).
				kind: "property",
				meta: compose(args, composeFn),
				token: Symbol("accessorIntercept"),
				unique,
			});

			return result;
		};

	return Object.assign(decoratorFn, {
		key,
		...createMemberFactoryHelpers<TMeta>(key, "property", label),
	}) as DecoratedAccessorFactory<TMeta, TArgs, TValue>;
}
