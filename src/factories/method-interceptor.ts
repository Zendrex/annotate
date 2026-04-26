import { mintMetadataKey } from "../metadata/cardinality-registry";
import { buildMethodFactory } from "./method-decorator";
import type { AnyFn, DecoratedMethodFactory, DecoratorOptions, MethodInterceptorOptions } from "./types";

/**
 * Method decorator factory that replaces the method with the return value of
 * `intercept`. The hook receives the original method, a `readMetadata(instance)`
 * reader, and an {@link InterceptorContext} carrying the member name, static
 * flag, and `kind: "method"`.
 */
export function createMethodInterceptor<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TMethod extends AnyFn = AnyFn,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(options: MethodInterceptorOptions<TMeta, TArgs, TMethod>): DecoratedMethodFactory<TMeta, TArgs, TMethod, TThis> {
	const key = mintMetadataKey<TMeta>("unique", options.name);
	const { intercept, ...rest } = options;
	return buildMethodFactory<TMeta, TArgs, TMethod, TThis>(key, rest as DecoratorOptions<TMeta, TArgs>, { intercept });
}

/**
 * List-cardinality variant of {@link createMethodInterceptor}: repeat
 * decorations append one entry each instead of throwing
 * `DuplicateMetadataError`. Inside `intercept`, `readMetadata(instance)`
 * returns the full accumulated list for the `(instance, member, key)` site.
 * `.key` is branded as a list key.
 */
export function createMethodListInterceptor<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TMethod extends AnyFn = AnyFn,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(
	options: MethodInterceptorOptions<TMeta, TArgs, TMethod>
): DecoratedMethodFactory<TMeta, TArgs, TMethod, TThis, "list"> {
	const key = mintMetadataKey<TMeta>("list", options.name);
	const { intercept, ...rest } = options;
	return buildMethodFactory<TMeta, TArgs, TMethod, TThis, "list">(key, rest as DecoratorOptions<TMeta, TArgs>, {
		intercept,
	});
}
