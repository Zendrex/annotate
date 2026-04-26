import { mintMetadataKey } from "../metadata/cardinality-registry";
import {
	compose,
	createMemberFactoryHelpers,
	createMemberMetadataReader,
	emitMemberDecoration,
	mergeExtendedOptions,
	prepareFactoryShell,
} from "./shared";
import type { Cardinality, MetadataKey } from "../metadata/types";
import type { AnyFn, DecoratedMethodFactory, DecoratorOptions, DeriveOptions, InterceptorContext } from "./types";

/**
 * Hook bundle for {@link buildMethodFactory}. The `intercept` callback receives
 * the original method, a per-member `readMetadata` reader, and an
 * {@link InterceptorContext}; its return value replaces the method.
 */
export interface MethodHookRefs<TMeta, TMethod extends AnyFn> {
	intercept: (original: TMethod, readMetadata: (instance: object) => TMeta[], context: InterceptorContext) => TMethod;
}

/**
 * Builds a method decorator factory using the shared member metadata path.
 * Pair with {@link MethodHookRefs} via {@link buildMethodFactory} to add
 * method interception.
 */
export function createMethodDecorator<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TMethod extends AnyFn = AnyFn,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(options?: DecoratorOptions<TMeta, TArgs>): DecoratedMethodFactory<TMeta, TArgs, TMethod, TThis> {
	const key = mintMetadataKey<TMeta>("unique", options?.name);
	return buildMethodFactory<TMeta, TArgs, TMethod, TThis>(key, options);
}

/**
 * Lower-level form of {@link createMethodDecorator} that accepts a pre-minted
 * key and optional {@link MethodHookRefs}. The intercept return value (if any)
 * replaces the original method; storage uses a distinct token per decoration
 * to keep ordering consistent with non-intercepting variants. `derive` reuses
 * `hookRefs` and merges options.
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
	const { composeFn, label, validators } = prepareFactoryShell<TMeta, TArgs>(key, options);
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

	const derive = <TNewThis = TThis>(
		childOptions?: DeriveOptions<TMeta, TArgs>
	): DecoratedMethodFactory<TMeta, TArgs, TMethod, TNewThis, TCard> =>
		buildMethodFactory<TMeta, TArgs, TMethod, TNewThis, TCard>(
			key,
			mergeExtendedOptions(options, childOptions),
			hookRefs
		);

	return Object.assign(decoratorFn, {
		key,
		...createMemberFactoryHelpers<TMeta, TCard>(key, "method", label),
		derive,
	}) as DecoratedMethodFactory<TMeta, TArgs, TMethod, TThis, TCard>;
}

/**
 * List-cardinality method decorator: repeat decorations append entries instead
 * of throwing on duplicates. `.key` is branded as a list key.
 */
export function createMethodListDecorator<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TMethod extends AnyFn = AnyFn,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(options?: DecoratorOptions<TMeta, TArgs>): DecoratedMethodFactory<TMeta, TArgs, TMethod, TThis, "list"> {
	const key = mintMetadataKey<TMeta>("list", options?.name);
	return buildMethodFactory<TMeta, TArgs, TMethod, TThis, "list">(key, options);
}
