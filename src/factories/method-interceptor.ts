import { mintMetadataKey } from "../metadata/cardinality-registry";
import { buildMethodFactory } from "./method-decorator";
import type { AnyFn, DecoratedMethodFactory, DecoratorOptions, MethodInterceptorOptions } from "./types";

/**
 * Builds a method decorator factory that replaces the method with the return
 * value of `intercept`. That function receives the original method, a
 * `readMetadata(instance)` callback, and `InterceptorContext` (member name,
 * static flag, kind `"method"`).
 */
export function createMethodInterceptor<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TMethod extends AnyFn = AnyFn,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(options: MethodInterceptorOptions<TMeta, TArgs, TMethod>): DecoratedMethodFactory<TMeta, TArgs, TMethod, TThis> {
	const key = mintMetadataKey<TMeta, "unique">("unique", options.name);
	const { intercept, ...rest } = options;
	return buildMethodFactory<TMeta, TArgs, TMethod, TThis>(key, rest as DecoratorOptions<TMeta, TArgs>, { intercept });
}

/**
 * Like `intercept.method`, but for list-cardinality metadata. Multiple decorations
 * of the same method with the same factory each append one entry (no `DuplicateMetadataError`).
 *
 * Inside each `intercept` callback, `readMetadata(instance)` returns the full accumulated
 * list for the `(instance, member, key)` site — all decorations applied to that method.
 *
 * Exposes `.key` typed as `ListMetadataKey<TMeta>`.
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
	const key = mintMetadataKey<TMeta, "list">("list", options.name);
	const { intercept, ...rest } = options;
	return buildMethodFactory<TMeta, TArgs, TMethod, TThis, "list">(key, rest as DecoratorOptions<TMeta, TArgs>, {
		intercept,
	});
}
