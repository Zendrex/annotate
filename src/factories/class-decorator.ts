import { mintMetadataKey } from "../metadata/cardinality";
import { appendClassMeta } from "../metadata/stores/class-meta-store";
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

export function createClassDecorator<TMeta, TArgs extends unknown[] = [TMeta], TInstance = unknown>(
	options?: DecoratorOptions<TMeta, TArgs>
): DecoratedClassFactory<TMeta, TArgs, TInstance> {
	const key = mintMetadataKey<TMeta>("unique", options?.name);
	return buildClassFactory<TMeta, TArgs, TInstance>(key, options);
}

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

export function createClassListDecorator<TMeta, TArgs extends unknown[] = [TMeta], TInstance = unknown>(
	options?: DecoratorOptions<TMeta, TArgs>
): DecoratedClassFactory<TMeta, TArgs, TInstance, "list"> {
	const key = mintMetadataKey<TMeta>("list", options?.name);
	return buildClassFactory<TMeta, TArgs, TInstance, "list">(key, options);
}
