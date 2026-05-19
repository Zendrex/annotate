import { mintMetadataKey } from "../metadata/cardinality-registry";
import {
	compose,
	createMemberFactoryHelpers,
	createMemberMetadataReader,
	emitMemberDecoration,
	mergeExtendedOptions,
	prepareFactoryShell,
} from "./shared";
import type { Cardinality, MemberKind, MetadataKey } from "../metadata/types";
import type {
	AccessorInterceptorOptions,
	DecoratedAccessorFactory,
	DecoratorOptions,
	DeriveOptions,
	InterceptorContext,
} from "./types";

/** @internal Hook bundle preserved by `derive` across factory rebuilds. */
export interface AccessorHookRefs<TMeta, TValue> {
	onGet?: (
		original: () => TValue,
		readMetadata: (instance: object) => TMeta[],
		context: InterceptorContext
	) => () => TValue;
	onSet?: (
		original: (value: TValue) => void,
		readMetadata: (instance: object) => TMeta[],
		context: InterceptorContext
	) => (value: TValue) => void;
}

/**
 * Stage 3 auto-accessor interceptor that wraps the generated getter and/or setter.
 *
 * @throws {TypeError} When neither `onGet` nor `onSet` is provided.
 */
export function createAccessorInterceptor<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TValue = unknown,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(options: AccessorInterceptorOptions<TMeta, TArgs, TValue>): DecoratedAccessorFactory<TMeta, TArgs, TValue, TThis> {
	requireAccessorHook(options, "intercept.accessor");

	const key = mintMetadataKey<TMeta>("unique", options.name);
	const { onGet, onSet, ...rest } = options;
	return buildAccessorFactory<TMeta, TArgs, TValue, TThis>(key, rest as DecoratorOptions<TMeta, TArgs>, {
		onGet,
		onSet,
	});
}

/** @internal Builds the factory against a pre-minted key; reused by `derive`. */
export function buildAccessorFactory<
	TMeta,
	TArgs extends unknown[],
	TValue,
	TThis,
	TCard extends Cardinality = "unique",
>(
	key: MetadataKey<TMeta, TCard>,
	options: DecoratorOptions<TMeta, TArgs> | undefined,
	hookRefs: AccessorHookRefs<TMeta, TValue>,
	storedKind: Extract<MemberKind, "property" | "accessor"> = "property"
): DecoratedAccessorFactory<TMeta, TArgs, TValue, TThis, TCard> {
	const { composeFn, label, validators } = prepareFactoryShell<TMeta, TArgs>(key, options);
	const { onGet, onSet } = hookRefs;

	const decoratorFn =
		(...args: TArgs) =>
		(
			value: ClassAccessorDecoratorTarget<TThis, TValue>,
			context: ClassAccessorDecoratorContext<TThis, TValue>
		): ClassAccessorDecoratorResult<TThis, TValue> => {
			const memberName = context.name;
			const isStatic = context.static;

			const interceptorContext: InterceptorContext = {
				name: memberName,
				static: isStatic,
				kind: "accessor",
			};

			const readMetadata = createMemberMetadataReader<TMeta>(key, memberName, isStatic);

			const result: ClassAccessorDecoratorResult<TThis, TValue> = {};
			if (onGet) {
				result.get = onGet(value.get, readMetadata, interceptorContext);
			}
			if (onSet) {
				result.set = onSet(value.set, readMetadata, interceptorContext);
			}

			emitMemberDecoration({
				context,
				key,
				kind: storedKind,
				meta: compose(args, composeFn),
				token: Symbol("accessorIntercept"),
				validators,
			});

			return result;
		};

	const derive = <TNewThis = TThis>(
		childOptions?: DeriveOptions<TMeta, TArgs>
	): DecoratedAccessorFactory<TMeta, TArgs, TValue, TNewThis, TCard> =>
		buildAccessorFactory<TMeta, TArgs, TValue, TNewThis, TCard>(
			key,
			mergeExtendedOptions(options, childOptions),
			hookRefs,
			storedKind
		);

	return Object.assign(decoratorFn, {
		key,
		...createMemberFactoryHelpers<TMeta, TCard>(key, "property", label),
		derive,
	}) as DecoratedAccessorFactory<TMeta, TArgs, TValue, TThis, TCard>;
}

/**
 * List-cardinality variant of {@link createAccessorInterceptor}: repeat
 * decorations append entries instead of throwing on duplicates.
 *
 * @throws {TypeError} When neither `onGet` nor `onSet` is provided.
 */
export function createAccessorListInterceptor<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TValue = unknown,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(
	options: AccessorInterceptorOptions<TMeta, TArgs, TValue>
): DecoratedAccessorFactory<TMeta, TArgs, TValue, TThis, "list"> {
	requireAccessorHook(options, "intercept.accessor.list");

	const key = mintMetadataKey<TMeta>("list", options.name);
	const { onGet, onSet, ...rest } = options;
	return buildAccessorFactory<TMeta, TArgs, TValue, TThis, "list">(key, rest as DecoratorOptions<TMeta, TArgs>, {
		onGet,
		onSet,
	});
}

function requireAccessorHook(options: { onGet?: unknown; onSet?: unknown }, label: string): void {
	if (!(options.onGet || options.onSet)) {
		throw new TypeError(`${label}: provide at least one of onGet or onSet`);
	}
}
