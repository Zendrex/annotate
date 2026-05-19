import { appendClassMeta } from "../../metadata/stores/class-meta-store";
import { commitDecoration, mapArgs, prepareTargetBuilder } from "../target-shared";
import type { Cardinality, Ctor, MetadataKey } from "../../metadata/types";
import type { AnyConstructor } from "../../reflector/types";
import type { AnyClass, InternalAnnotationOptions } from "../internal-types";

export type ClassTargetDecorator<_TMeta, TArgs extends unknown[], TInstance> = (
	...args: TArgs
) => <T extends AnyClass<TInstance>>(value: T, context: ClassDecoratorContext<T>) => void;

export function buildClassTarget<TMeta, TArgs extends unknown[], TInstance, TCard extends Cardinality = "unique">(
	key: MetadataKey<TMeta, TCard>,
	options: InternalAnnotationOptions<TMeta, TArgs> | undefined
): ClassTargetDecorator<TMeta, TArgs, TInstance> {
	const { argsMapper, validators } = prepareTargetBuilder<TMeta, TArgs>(key, options);

	return (...args: TArgs) =>
		<T extends AnyClass<TInstance>>(value: T, context: ClassDecoratorContext<T>): void => {
			const meta = mapArgs(args, argsMapper);
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
}
