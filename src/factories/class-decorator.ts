import { mintListKey, mintUniqueKey } from "../metadata/cardinality-registry";
import { appendClassMeta } from "../metadata/class-meta-store";
import { registerCtor } from "../metadata/metadata-ctor-correlation";
import { flushFor } from "../metadata/metadata-deferred-queue";
import { compose, createClassFactoryHelpers, labelFor, mergeExtendedOptions } from "./shared";
import { buildValidatorChain, runValidatorChain } from "./validator-chain";
import type { Cardinality, MetadataKey } from "../metadata/types";
import type { AnyConstructor } from "../reflector/types";
import type { DecoratedClassFactory, DecoratorOptions, DeriveOptions } from "./types";

/**
 * Returns a class decorator factory: each decorated class stores metadata under a
 * generated key, runs optional `validate` / `requireInstanceOf` (see {@link buildClassFactory}),
 * and wires the constructor into the reflector (`registerCtor` + `flushFor` after
 * `appendClassMeta`).
 *
 * @param options - Optional `name` (affects the key), `compose`, `validate`, and `requireInstanceOf`.
 */
export function createClassDecorator<TMeta, TArgs extends unknown[] = [TMeta], TInstance = unknown>(
	options?: DecoratorOptions<TMeta, TArgs>
): DecoratedClassFactory<TMeta, TArgs, TInstance> {
	const key = mintUniqueKey<TMeta>(options?.name);
	return buildClassFactory<TMeta, TArgs, TInstance>(key, options);
}

/**
 * Builds a {@link createClassDecorator}-style factory for a fixed metadata key, merging
 * `options` the same way as the public entrypoint. The returned callable composes
 * `TMeta` from decorator arguments (identity tuple by default, or `options.compose`),
 * runs the validator chain if configured, then appends class-level metadata. After
 * metadata is written, the constructor is registered on decorator context metadata
 * and deferred reflector work is flushed so `reader` / scoped APIs stay consistent.
 *
 * The object also exposes `key`, `reader`, `first`, `has`, `all`, and `derive`
 * (child options merged via `mergeExtendedOptions` while preserving the key).
 *
 * Accepts both `UniqueMetadataKey` and `ListMetadataKey` via the wider `MetadataKey` bound.
 * Cardinality enforcement is delegated to `appendClassMeta` / the store layer.
 *
 * @param key - Metadata key this factory reads and writes.
 * @param options - Optional compose/validation and display `name` for labels.
 */
export function buildClassFactory<TMeta, TArgs extends unknown[], TInstance, TCard extends Cardinality = "unique">(
	key: MetadataKey<TMeta, TCard>,
	options: DecoratorOptions<TMeta, TArgs> | undefined
): DecoratedClassFactory<TMeta, TArgs, TInstance, TCard> {
	const { compose: composeFn, name } = options ?? {};
	const label = labelFor(name, key);
	const validators = buildValidatorChain<TMeta>(options, label, key);

	const decoratorFn =
		(...args: TArgs) =>
		// biome-ignore lint/suspicious/noExplicitAny: structural Stage-3 generic
		<T extends abstract new (...a: any[]) => TInstance>(value: T, context: ClassDecoratorContext<T>): void => {
			const meta = compose(args, composeFn);
			if (validators) {
				runValidatorChain(validators, meta, {
					target: value as unknown as AnyConstructor,
					kind: "class",
					static: false,
				});
			}
			appendClassMeta(value, key, meta);
			registerCtor(value, context.metadata);
			flushFor(value, context.metadata);
		};

	const derive = <TNewInstance = TInstance>(
		childOptions?: DeriveOptions<TMeta, TArgs>
	): DecoratedClassFactory<TMeta, TArgs, TNewInstance, TCard> =>
		buildClassFactory<TMeta, TArgs, TNewInstance, TCard>(key, mergeExtendedOptions(options, childOptions));

	return Object.assign(decoratorFn, {
		key,
		...createClassFactoryHelpers<TMeta, TCard>(key, label),
		derive,
	}) as DecoratedClassFactory<TMeta, TArgs, TInstance, TCard>;
}

/**
 * Returns a class decorator factory that accumulates metadata (list cardinality).
 * Multiple decorations of the same class with the same factory each append one entry.
 * Exposes `.key` typed as `ListMetadataKey<TMeta>`.
 *
 * @param options - Optional `name`, `compose`, `validate`, `requireInstanceOf`.
 */
export function createClassListDecorator<TMeta, TArgs extends unknown[] = [TMeta], TInstance = unknown>(
	options?: DecoratorOptions<TMeta, TArgs>
): DecoratedClassFactory<TMeta, TArgs, TInstance, "list"> {
	const key = mintListKey<TMeta>(options?.name);
	return buildClassFactory<TMeta, TArgs, TInstance, "list">(key, options);
}
