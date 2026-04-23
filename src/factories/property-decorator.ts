import { compose, createMemberFactoryHelpers, emitMemberDecoration, generateKey, labelFor } from "./shared";
import type { DecoratedPropertyFactory, DecoratorOptions } from "./types";

/**
 * Create a typed field decorator. `TField` constrains the declared type of the
 * decorated field — `createPropertyDecorator<M, [M], number>()` rejects
 * `@Dec() flag!: boolean;` at compile time via the structural assignability of
 * `ClassFieldDecoratorContext<This, Value>`.
 *
 * Field decorators register lazily on first instantiation. For pre-instantiation
 * reflection on instance-member-only classes, call `materialize(ctor)` first or
 * apply a class decorator (which drains the pending buffer at class-body eval).
 */
export function createPropertyDecorator<TMeta, TArgs extends unknown[] = [TMeta], TField = unknown>(
	options?: DecoratorOptions<TMeta, TArgs>
): DecoratedPropertyFactory<TMeta, TArgs, TField> {
	const key = generateKey(options?.name);
	const { compose: composeFn, name, unique = false } = options ?? {};
	const label = labelFor(name, key);

	const decoratorFn =
		(...args: TArgs) =>
		// biome-ignore lint/suspicious/noExplicitAny: EA-3 — ClassFieldDecoratorContext's This generic must default to `any` so typed `this:` on fields type-checks
		(_value: undefined, context: ClassFieldDecoratorContext<any, TField>): void => {
			emitMemberDecoration({
				context,
				key,
				kind: "property",
				meta: compose(args, composeFn),
				token: Symbol("propertyDecoration"),
				unique,
			});
		};

	return Object.assign(decoratorFn, {
		key,
		...createMemberFactoryHelpers<TMeta>(key, "property", label),
	}) as DecoratedPropertyFactory<TMeta, TArgs, TField>;
}
