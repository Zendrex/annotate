import { mintListKey, mintUniqueKey } from "../metadata/cardinality-registry";
import {
	compose,
	createMemberFactoryHelpers,
	createMemberMetadataReader,
	emitMemberDecoration,
	labelFor,
	mergeExtendedOptions,
} from "./shared";
import { buildValidatorChain } from "./validator-chain";
import type { Cardinality, MetadataKey } from "../metadata/types";
import type {
	AccessorInterceptorOptions,
	DecoratedAccessorFactory,
	DecoratorOptions,
	DeriveOptions,
	InterceptorContext,
} from "./types";

/**
 * Hook implementations passed into {@link buildAccessorFactory}. Separated from
 * {@link AccessorInterceptorOptions} so the factory can be built with stable
 * references for `derive` reuse.
 */
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
 * Like `intercept.method`, but for Stage 3 auto-accessors. Supply at least one of
 * `onGet` or `onSet` to wrap the generated getter and/or setter.
 *
 * @throws {TypeError} If neither `onGet` nor `onSet` is provided.
 */
export function createAccessorInterceptor<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TValue = unknown,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(options: AccessorInterceptorOptions<TMeta, TArgs, TValue>): DecoratedAccessorFactory<TMeta, TArgs, TValue, TThis> {
	requireAccessorHook(options, "intercept.accessor");

	const key = mintUniqueKey<TMeta>(options.name);
	const { onGet, onSet, ...rest } = options;
	return buildAccessorFactory<TMeta, TArgs, TValue, TThis>(key, rest as DecoratorOptions<TMeta, TArgs>, {
		onGet,
		onSet,
	});
}

/**
 * Low-level accessor interceptor factory: emits metadata through the same path
 * as `createAccessorInterceptor` but accepts a precomputed key and optional
 * `derive` merging. Exposed for advanced composition; prefer `createAccessorInterceptor`.
 */
export function buildAccessorFactory<
	TMeta,
	TArgs extends unknown[],
	TValue,
	TThis,
	TCard extends Cardinality = "unique",
>(
	key: MetadataKey<TMeta, TCard>,
	options: DecoratorOptions<TMeta, TArgs> | undefined,
	hookRefs: AccessorHookRefs<TMeta, TValue>
): DecoratedAccessorFactory<TMeta, TArgs, TValue, TThis, TCard> {
	const { compose: composeFn, name } = options ?? {};
	const label = labelFor(name, key);
	const validators = buildValidatorChain<TMeta>(options, label, key);
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
				kind: "property",
				meta: compose(args, composeFn),
				token: Symbol("accessorIntercept"),
				validators,
			});

			return result;
		};

	const derive = <TNewValue = TValue, TNewThis = TThis>(
		childOptions?: DeriveOptions<TMeta, TArgs>
	): DecoratedAccessorFactory<TMeta, TArgs, TNewValue, TNewThis, TCard> =>
		buildAccessorFactory<TMeta, TArgs, TNewValue, TNewThis, TCard>(
			key,
			mergeExtendedOptions(options, childOptions),
			hookRefs as unknown as AccessorHookRefs<TMeta, TNewValue>
		);

	return Object.assign(decoratorFn, {
		key,
		...createMemberFactoryHelpers<TMeta, TCard>(key, "property", label),
		derive,
	}) as DecoratedAccessorFactory<TMeta, TArgs, TValue, TThis, TCard>;
}

/**
 * Like `intercept.accessor`, but for list-cardinality metadata. Multiple decorations
 * of the same accessor with the same factory each append one entry (no `DuplicateMetadataError`).
 * Exposes `.key` typed as `ListMetadataKey<TMeta>`.
 *
 * @throws {TypeError} If neither `onGet` nor `onSet` is provided.
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

	const key = mintListKey<TMeta>(options.name);
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
