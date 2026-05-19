import { emitMemberDecoration } from "../decorations";
import { createMemberMetadataReader, mapArgs, prepareTargetBuilder } from "./shared";
import type { Cardinality, MetadataKey } from "../../metadata/types";
import type { AnyFn, InternalAnnotationOptions, InternalInterceptorContext, MethodHookRefs } from "../internal-types";

export type MethodTargetDecorator<_TMeta, TArgs extends unknown[], TMethod extends AnyFn, TThis> = (
	...args: TArgs
) => (value: TMethod, context: ClassMethodDecoratorContext<TThis, TMethod>) => TMethod | undefined;

export function buildMethodTarget<
	TMeta,
	TArgs extends unknown[],
	TMethod extends AnyFn,
	TThis,
	TCard extends Cardinality = "unique",
>(
	key: MetadataKey<TMeta, TCard>,
	options: InternalAnnotationOptions<TMeta, TArgs> | undefined,
	hookRefs?: MethodHookRefs<TMeta, TMethod>
): MethodTargetDecorator<TMeta, TArgs, TMethod, TThis> {
	const { argsMapper, validators } = prepareTargetBuilder<TMeta, TArgs>(key, options);
	const wrap = hookRefs?.wrap;

	return (...args: TArgs) =>
		(value: TMethod, context: ClassMethodDecoratorContext<TThis, TMethod>): TMethod | undefined => {
			let replacement: TMethod | undefined;
			if (wrap) {
				const interceptorContext: InternalInterceptorContext = {
					name: context.name,
					static: context.static,
					kind: "method",
				};
				replacement = wrap(
					value,
					createMemberMetadataReader<TMeta>(key, context.name, context.static),
					interceptorContext
				);
			}

			emitMemberDecoration({
				context,
				key,
				kind: "method",
				meta: mapArgs(args, argsMapper),
				token: Symbol(wrap ? "methodIntercept" : "methodDecoration"),
				validators,
			});

			return replacement;
		};
}
