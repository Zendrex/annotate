import { mintUniqueKey } from "../metadata/cardinality-registry";
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
	const key = mintUniqueKey<TMeta>(options.name);
	const { intercept, ...rest } = options;
	return buildMethodFactory<TMeta, TArgs, TMethod, TThis>(key, rest as DecoratorOptions<TMeta, TArgs>, { intercept });
}
