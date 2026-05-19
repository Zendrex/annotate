import { createMemberMetadataReader, emitMemberDecoration, mapArgs, prepareTargetBuilder } from "../target-shared";
import type { Cardinality, MemberKind, MetadataKey } from "../../metadata/types";
import type { AccessorHookRefs, InternalAnnotationOptions, InternalInterceptorContext } from "../internal-types";

export type AccessorTargetDecorator<_TMeta, TArgs extends unknown[], TValue, TThis> = (
	...args: TArgs
) => (
	value: ClassAccessorDecoratorTarget<TThis, TValue>,
	context: ClassAccessorDecoratorContext<TThis, TValue>
) => ClassAccessorDecoratorResult<TThis, TValue> | undefined;

export function buildAccessorTarget<
	TMeta,
	TArgs extends unknown[],
	TValue,
	TThis,
	TCard extends Cardinality = "unique",
>(
	key: MetadataKey<TMeta, TCard>,
	options: InternalAnnotationOptions<TMeta, TArgs> | undefined,
	hookRefs: AccessorHookRefs<TMeta, TValue> = {},
	storedKind: Extract<MemberKind, "property" | "accessor"> = "accessor"
): AccessorTargetDecorator<TMeta, TArgs, TValue, TThis> {
	const { argsMapper, validators } = prepareTargetBuilder<TMeta, TArgs>(key, options);
	const { get, set } = hookRefs;

	return (...args: TArgs) =>
		(
			value: ClassAccessorDecoratorTarget<TThis, TValue>,
			context: ClassAccessorDecoratorContext<TThis, TValue>
		): ClassAccessorDecoratorResult<TThis, TValue> => {
			const memberName = context.name;
			const isStatic = context.static;

			const interceptorContext: InternalInterceptorContext = {
				name: memberName,
				static: isStatic,
				kind: "accessor",
			};

			const readMetadata = createMemberMetadataReader<TMeta>(key, memberName, isStatic);

			const result: ClassAccessorDecoratorResult<TThis, TValue> = {};
			if (get) {
				result.get = get(value.get, readMetadata, interceptorContext);
			}
			if (set) {
				result.set = set(value.set, readMetadata, interceptorContext);
			}

			emitMemberDecoration({
				context,
				key,
				kind: storedKind,
				meta: mapArgs(args, argsMapper),
				token: Symbol(get || set ? "accessorIntercept" : "accessorDecoration"),
				validators,
			});

			return result;
		};
}
