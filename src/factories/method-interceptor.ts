import { mintMetadataKey } from "../metadata/cardinality";
import { buildMethodFactory } from "./method-decorator";
import type { AnyFn, DecoratedMethodFactory, DecoratorOptions, MethodInterceptorOptions } from "./types";

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
