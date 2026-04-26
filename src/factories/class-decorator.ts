import { mintMetadataKey } from "../metadata/cardinality-registry";
import { appendClassMeta } from "../metadata/class-meta-store";
import {
	commitDecoration,
	compose,
	createClassFactoryHelpers,
	mergeExtendedOptions,
	prepareFactoryShell,
} from "./shared";
import type { Cardinality, Ctor, MetadataKey } from "../metadata/types";
import type { AnyConstructor } from "../reflector/types";
import type { AnyClass, DecoratedClassFactory, DecoratorOptions, DeriveOptions } from "./types";

/**
 * Builds a class decorator factory. Composed metadata is appended via
 * {@link commitDecoration}, which validates, registers the constructor, and
 * flushes any deferred work pending on the decorator-context bag.
 */
export function createClassDecorator<TMeta, TArgs extends unknown[] = [TMeta], TInstance = unknown>(
	options?: DecoratorOptions<TMeta, TArgs>
): DecoratedClassFactory<TMeta, TArgs, TInstance> {
	const key = mintMetadataKey<TMeta>("unique", options?.name);
	return buildClassFactory<TMeta, TArgs, TInstance>(key, options);
}

/**
 * Lower-level form of {@link createClassDecorator} that accepts a pre-minted
 * key. `derive` rebuilds against the same key with options merged via
 * {@link mergeExtendedOptions}.
 */
export function buildClassFactory<TMeta, TArgs extends unknown[], TInstance, TCard extends Cardinality = "unique">(
	key: MetadataKey<TMeta, TCard>,
	options: DecoratorOptions<TMeta, TArgs> | undefined
): DecoratedClassFactory<TMeta, TArgs, TInstance, TCard> {
	const { composeFn, label, validators } = prepareFactoryShell<TMeta, TArgs>(key, options);

	const decoratorFn =
		(...args: TArgs) =>
		<T extends AnyClass<TInstance>>(value: T, context: ClassDecoratorContext<T>): void => {
			const meta = compose(args, composeFn);
			commitDecoration({
				ctor: value as unknown as Ctor,
				correlation: context.metadata,
				meta,
				validators,
				validationContext: {
					target: value as unknown as AnyConstructor,
					kind: "class",
					static: false,
				},
				append: () => {
					appendClassMeta(value, key, meta);
				},
			});
		};

	const derive = <TNewInstance = TInstance>(
		childOptions?: DeriveOptions<TMeta, TArgs>
	): DecoratedClassFactory<TMeta, TArgs, TNewInstance, TCard> =>
		buildClassFactory<TMeta, TArgs, TNewInstance, TCard>(key, mergeExtendedOptions(options, childOptions));

	return Object.assign(decoratorFn, {
		key,
		...createClassFactoryHelpers<TMeta, TCard>(key, label),
		derive,
	}) as DecoratedClassFactory<TMeta, TArgs, TInstance, TCard>;
}

/**
 * List-cardinality class decorator: repeat decorations append entries instead
 * of throwing on duplicates. `.key` is branded as a list key.
 */
export function createClassListDecorator<TMeta, TArgs extends unknown[] = [TMeta], TInstance = unknown>(
	options?: DecoratorOptions<TMeta, TArgs>
): DecoratedClassFactory<TMeta, TArgs, TInstance, "list"> {
	const key = mintMetadataKey<TMeta>("list", options?.name);
	return buildClassFactory<TMeta, TArgs, TInstance, "list">(key, options);
}
