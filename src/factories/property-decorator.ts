import {
	compose,
	createMemberFactoryHelpers,
	emitMemberDecoration,
	generateKey,
	labelFor,
	mergeExtendedOptions,
} from "./shared";
import { buildValidatorChain } from "./validator-chain";
import type { MetadataKey } from "../metadata/types";
import type { DecoratedPropertyFactory, DecoratorOptions, DeriveOptions } from "./types";

/**
 * Returns a class field (property) decorator factory. The Stage-3 field form passes
 * `undefined` for the value; all work happens in `emitMemberDecoration`, which
 * composes `TMeta`, runs validators, applies `unique` to prevent duplicate values for
 * the same key on that field, and records metadata when the class is initialized
 * (same member-decoration pipeline as methods, without an intercept/replacement
 * hook). The result includes `key`, `reader` / `first` / `has` / `all` scoped to
 * property names, and `derive` for merged child options.
 *
 * @param options - Optional `name`, `compose`, `validate`, `requireInstanceOf`, `unique`.
 */
export function createPropertyDecorator<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TField = unknown,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(options?: DecoratorOptions<TMeta, TArgs>): DecoratedPropertyFactory<TMeta, TArgs, TField, TThis> {
	const key = generateKey(options?.name);
	return buildPropertyFactory<TMeta, TArgs, TField, TThis>(key, options);
}

/**
 * Builds a {@link createPropertyDecorator}-style factory for a fixed key. Behavior
 * matches the public entrypoint: `emitMemberDecoration` with `kind: "property"`,
 * composed metadata, optional validator chain, and `unique` for duplicate
 * detection on the same field. `derive` reuses the key and merges options via
 * `mergeExtendedOptions`.
 *
 * @param key - Metadata key this factory reads and writes.
 * @param options - Optional compose/validation/uniqueness and display `name` for labels.
 */
export function buildPropertyFactory<TMeta, TArgs extends unknown[], TField, TThis>(
	key: MetadataKey,
	options: DecoratorOptions<TMeta, TArgs> | undefined
): DecoratedPropertyFactory<TMeta, TArgs, TField, TThis> {
	const { compose: composeFn, name, unique = false } = options ?? {};
	const label = labelFor(name, key);
	const validators = buildValidatorChain<TMeta>(options, label, key);

	const decoratorFn =
		(...args: TArgs) =>
		(_value: undefined, context: ClassFieldDecoratorContext<TThis, TField>): void => {
			emitMemberDecoration({
				context,
				key,
				kind: "property",
				meta: compose(args, composeFn),
				token: Symbol("propertyDecoration"),
				unique,
				validators,
			});
		};

	const derive = <TNewField = TField, TNewThis = TThis>(
		childOptions?: DeriveOptions<TMeta, TArgs>
	): DecoratedPropertyFactory<TMeta, TArgs, TNewField, TNewThis> =>
		buildPropertyFactory<TMeta, TArgs, TNewField, TNewThis>(key, mergeExtendedOptions(options, childOptions));

	return Object.assign(decoratorFn, {
		key,
		...createMemberFactoryHelpers<TMeta>(key, "property", label),
		derive,
	}) as DecoratedPropertyFactory<TMeta, TArgs, TField, TThis>;
}
