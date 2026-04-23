import { compose, createMemberFactoryHelpers, emitMemberDecoration, generateKey, labelFor } from "./shared";
import type { AnyFn, DecoratedMethodFactory, DecoratorOptions } from "./types";

/**
 * Create a typed method decorator that records metadata without replacing the
 * method body. `TMethod` constrains the method signature the decorator may
 * apply to — narrowing it rejects applications to methods with incompatible
 * shapes at compile time.
 *
 * Applies to both instance and static methods. Instance applications register
 * lazily on first instantiation; static applications register at class-body
 * evaluation and drain the pending buffer.
 */
export function createMethodDecorator<TMeta, TArgs extends unknown[] = [TMeta], TMethod extends AnyFn = AnyFn>(
	options?: DecoratorOptions<TMeta, TArgs>
): DecoratedMethodFactory<TMeta, TArgs, TMethod> {
	const key = generateKey(options?.name);
	const { compose: composeFn, name, unique = false } = options ?? {};
	const label = labelFor(name, key);

	const decoratorFn =
		(...args: TArgs) =>
		// biome-ignore lint/suspicious/noExplicitAny: EA-3 — ClassMethodDecoratorContext's This generic must default to `any` so typed `this:` on methods type-checks
		(_value: TMethod, context: ClassMethodDecoratorContext<any, TMethod>): void => {
			emitMemberDecoration({
				context,
				key,
				kind: "method",
				meta: compose(args, composeFn),
				token: Symbol("methodDecoration"),
				unique,
			});
		};

	return Object.assign(decoratorFn, {
		key,
		...createMemberFactoryHelpers<TMeta>(key, "method", label),
	}) as DecoratedMethodFactory<TMeta, TArgs, TMethod>;
}
