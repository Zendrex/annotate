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
import type { AnyFn, DecoratedMethodFactory, DecoratorOptions, DeriveOptions, InterceptorContext } from "./types";

/**
 * Optional hooks for a method factory built with {@link buildMethodFactory}. When
 * `intercept` is supplied, the method decorator may return a replacement function;
 * the hook receives the original method, a reader over existing metadata for that
 * member, and an {@link InterceptorContext} (name, static flag, `kind: "method"`).
 */
export interface MethodHookRefs<TMeta, TMethod extends AnyFn> {
	intercept: (original: TMethod, readMetadata: (instance: object) => TMeta[], context: InterceptorContext) => TMethod;
}

/**
 * Returns a method decorator factory. Metadata is written through
 * `emitMemberDecoration` with the same key and validation as other member factories:
 * composed `TMeta` is stored and optionally validated. When advanced wiring is needed,
 * {@link buildMethodFactory} accepts {@link MethodHookRefs} for intercept-based replacement
 * and a distinct internal decoration token.
 *
 * @param options - Optional `name`, `compose`, `validate`, `requireInstanceOf`.
 */
export function createMethodDecorator<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TMethod extends AnyFn = AnyFn,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(options?: DecoratorOptions<TMeta, TArgs>): DecoratedMethodFactory<TMeta, TArgs, TMethod, TThis> {
	const key = mintUniqueKey<TMeta>(options?.name);
	return buildMethodFactory<TMeta, TArgs, TMethod, TThis>(key, options);
}

/**
 * Core implementation shared with {@link createMethodDecorator} and (with
 * `hookRefs`) other builds. Composes `TMeta` from args, then schedules member
 * metadata via `emitMemberDecoration` (class initialization callback path), applying
 * validators. If `hookRefs.intercept` is set, it runs first and the return value,
 * if any, becomes the new method; metadata emission still uses a stable token so
 * storage stays aligned with the non-intercept path. The returned object includes
 * `key`, reader helpers, and `derive` (reuses `hookRefs` and merges child options;
 * see inline note on `TNewMethod` narrowing).
 *
 * @param key - Fixed metadata key for this family of decorators.
 * @param options - Factory options; merged into derived factories by `derive`.
 * @param hookRefs - When present, enables intercept-based method replacement
 *   while metadata is still recorded for the member.
 */
export function buildMethodFactory<
	TMeta,
	TArgs extends unknown[],
	TMethod extends AnyFn,
	TThis,
	TCard extends Cardinality = "unique",
>(
	key: MetadataKey<TMeta, TCard>,
	options: DecoratorOptions<TMeta, TArgs> | undefined,
	hookRefs?: MethodHookRefs<TMeta, TMethod>
): DecoratedMethodFactory<TMeta, TArgs, TMethod, TThis, TCard> {
	const { compose: composeFn, name } = options ?? {};
	const label = labelFor(name, key);
	const validators = buildValidatorChain<TMeta>(options, label, key);
	const intercept = hookRefs?.intercept;

	const decoratorFn =
		(...args: TArgs) =>
		(value: TMethod, context: ClassMethodDecoratorContext<TThis, TMethod>): TMethod | undefined => {
			let replacement: TMethod | undefined;
			if (intercept) {
				const interceptorContext: InterceptorContext = {
					name: context.name,
					static: context.static,
					kind: "method",
				};
				replacement = intercept(
					value,
					createMemberMetadataReader<TMeta>(key, context.name, context.static),
					interceptorContext
				);
			}

			emitMemberDecoration({
				context,
				key,
				kind: "method",
				meta: compose(args, composeFn),
				token: Symbol(intercept ? "methodIntercept" : "methodDecoration"),
				validators,
			});

			return replacement;
		};

	const derive = <TNewMethod extends AnyFn = TMethod, TNewThis = TThis>(
		childOptions?: DeriveOptions<TMeta, TArgs>
	): DecoratedMethodFactory<TMeta, TArgs, TNewMethod, TNewThis, TCard> =>
		buildMethodFactory<TMeta, TArgs, TNewMethod, TNewThis, TCard>(
			key,
			mergeExtendedOptions(options, childOptions),
			hookRefs as MethodHookRefs<TMeta, TNewMethod> | undefined
		);

	return Object.assign(decoratorFn, {
		key,
		...createMemberFactoryHelpers<TMeta, TCard>(key, "method", label),
		derive,
	}) as DecoratedMethodFactory<TMeta, TArgs, TMethod, TThis, TCard>;
}

/**
 * Returns a method decorator factory that accumulates metadata (list cardinality).
 * Multiple decorations of the same method with the same factory each append one entry.
 * Exposes `.key` typed as `ListMetadataKey<TMeta>`.
 *
 * @param options - Optional `name`, `compose`, `validate`, `requireInstanceOf`.
 */
export function createMethodListDecorator<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TMethod extends AnyFn = AnyFn,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(options?: DecoratorOptions<TMeta, TArgs>): DecoratedMethodFactory<TMeta, TArgs, TMethod, TThis, "list"> {
	const key = mintListKey<TMeta>(options?.name);
	return buildMethodFactory<TMeta, TArgs, TMethod, TThis, "list">(key, options);
}
