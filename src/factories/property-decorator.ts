import { mintMetadataKey } from "../metadata/cardinality-registry";
import {
	compose,
	createMemberFactoryHelpers,
	emitMemberDecoration,
	mergeExtendedOptions,
	prepareFactoryShell,
} from "./shared";
import type { Cardinality, MemberKind, MetadataKey } from "../metadata/types";
import type { DecoratedPropertyFactory, DecoratorOptions, DeriveOptions } from "./types";

/** Builds a class-field decorator factory backed by a unique-cardinality metadata key. */
export function createPropertyDecorator<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TField = unknown,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(options?: DecoratorOptions<TMeta, TArgs>): DecoratedPropertyFactory<TMeta, TArgs, TField, TThis> {
	const key = mintMetadataKey<TMeta>("unique", options?.name);
	return buildPropertyFactory<TMeta, TArgs, TField, TThis>(key, options);
}

/** @internal Builds the factory against a pre-minted key; reused by `derive`. */
export function buildPropertyFactory<
	TMeta,
	TArgs extends unknown[],
	TField,
	TThis,
	TCard extends Cardinality = "unique",
>(
	key: MetadataKey<TMeta, TCard>,
	options: DecoratorOptions<TMeta, TArgs> | undefined,
	storedKind: Extract<MemberKind, "property" | "field"> = "property"
): DecoratedPropertyFactory<TMeta, TArgs, TField, TThis, TCard> {
	const { composeFn, label, validators } = prepareFactoryShell<TMeta, TArgs>(key, options);

	const decoratorFn =
		(...args: TArgs) =>
		(_value: undefined, context: ClassFieldDecoratorContext<TThis, TField>): void => {
			emitMemberDecoration({
				context,
				key,
				kind: storedKind,
				meta: compose(args, composeFn),
				token: Symbol("propertyDecoration"),
				validators,
			});
		};

	const derive = <TNewField = TField, TNewThis = TThis>(
		childOptions?: DeriveOptions<TMeta, TArgs>
	): DecoratedPropertyFactory<TMeta, TArgs, TNewField, TNewThis, TCard> =>
		buildPropertyFactory<TMeta, TArgs, TNewField, TNewThis, TCard>(
			key,
			mergeExtendedOptions(options, childOptions),
			storedKind
		);

	return Object.assign(decoratorFn, {
		key,
		...createMemberFactoryHelpers<TMeta, TCard>(key, "property", label),
		derive,
	}) as DecoratedPropertyFactory<TMeta, TArgs, TField, TThis, TCard>;
}

/**
 * List-cardinality field decorator: repeat decorations append entries instead
 * of throwing on duplicates. `.key` is branded as a list key.
 */
export function createPropertyListDecorator<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TField = unknown,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(options?: DecoratorOptions<TMeta, TArgs>): DecoratedPropertyFactory<TMeta, TArgs, TField, TThis, "list"> {
	const key = mintMetadataKey<TMeta>("list", options?.name);
	return buildPropertyFactory<TMeta, TArgs, TField, TThis, "list">(key, options);
}
