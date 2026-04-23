import { collectMemberMeta } from "../metadata/store";
import { compose, createMemberFactoryHelpers, emitMemberDecoration, generateKey, labelFor } from "./shared";
import type { Ctor } from "../metadata/types";
import type { AnyFn, DecoratedMethodFactory, InterceptorContext, MethodInterceptorOptions } from "./types";

/**
 * Create a method interceptor that wraps the original method with the function
 * returned by `options.intercept`. The interceptor receives a `readMetadata`
 * reader that, when called at invocation time, returns the full ancestor-merged
 * metadata array for the decorated member.
 *
 * `TMethod` constrains the method signature the decorator may apply to —
 * narrowing it (e.g. `(x: number) => number`) rejects applications to
 * methods with incompatible shapes at compile time.
 *
 * Applies to both instance and static methods. For instance methods the
 * metadata registers lazily on first instantiation; static applications
 * register at class-body evaluation and drain the pending buffer.
 */
export function createMethodInterceptor<TMeta, TArgs extends unknown[] = [TMeta], TMethod extends AnyFn = AnyFn>(
	options: MethodInterceptorOptions<TMeta, TArgs, TMethod>
): DecoratedMethodFactory<TMeta, TArgs, TMethod> {
	const key = generateKey(options.name);
	const { compose: composeFn, intercept, name, unique = false } = options;
	const label = labelFor(name, key);

	const decoratorFn =
		(...args: TArgs) =>
		// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
		(value: TMethod, context: ClassMethodDecoratorContext<any, TMethod>): TMethod => {
			const memberName = context.name;
			const isStatic = context.static;

			const interceptorContext: InterceptorContext = {
				name: memberName,
				static: isStatic,
				kind: "method",
			};

			const readMetadata = (instance: object): TMeta[] => {
				const ctor = isStatic ? (instance as unknown as Ctor) : (instance as { constructor: Ctor }).constructor;
				return collectMemberMeta<TMeta>(ctor, key, memberName);
			};

			const replacement = intercept(value, readMetadata, interceptorContext);

			emitMemberDecoration({
				context,
				key,
				kind: "method",
				meta: compose(args, composeFn),
				token: Symbol("methodIntercept"),
				unique,
			});

			return replacement;
		};

	return Object.assign(decoratorFn, {
		key,
		...createMemberFactoryHelpers<TMeta>(key, "method", label),
	}) as DecoratedMethodFactory<TMeta, TArgs, TMethod>;
}
