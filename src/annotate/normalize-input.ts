import { mintMetadataKey } from "../metadata/cardinality";
import type { DecoratorOptions } from "../factories/types";
import type { ValidatorFn } from "../factories/validator-types";
import type { MetadataKey } from "../metadata/types";
import type { AnyConstructor } from "../reflector/types";
import type { AnnotationOptions, Cardinality } from "./types";

export type InternalCardinalityOf<TCard extends Cardinality> = TCard extends "many" ? "list" : "unique";

export interface LegacyOptionsInput<TMeta, TArgs extends unknown[], TCard extends Cardinality>
	extends AnnotationOptions<TMeta, TCard> {
	args?: (...args: TArgs) => TMeta;
}

export type BuilderInput<TMeta, TArgs extends unknown[], TCard extends Cardinality> =
	| ((...args: TArgs) => TMeta)
	| LegacyOptionsInput<TMeta, TArgs, TCard>
	| undefined;

export function resolveCardinality<TMeta, TArgs extends unknown[], TCard extends Cardinality>(
	input: BuilderInput<TMeta, TArgs, TCard>
): TCard {
	return (typeof input === "object" && input?.cardinality ? input.cardinality : "one") as TCard;
}

export function toLegacyOptions<TMeta, TArgs extends unknown[], TCard extends Cardinality>(
	input: BuilderInput<TMeta, TArgs, TCard>
): DecoratorOptions<TMeta, TArgs> | undefined {
	if (typeof input === "function") {
		return { compose: input } as DecoratorOptions<TMeta, TArgs>;
	}
	if (!input) {
		return;
	}
	const options: {
		compose?: (...args: TArgs) => TMeta;
		name?: string;
		requireInstanceOf?: AnyConstructor;
		validate?: ValidatorFn<TMeta>;
	} = {};
	if (input.args) {
		options.compose = input.args;
	}
	if (input.label !== undefined) {
		options.name = input.label;
	}
	if (input.requires) {
		options.requireInstanceOf = input.requires;
	}
	if (input.validate) {
		options.validate = input.validate;
	}
	return options as DecoratorOptions<TMeta, TArgs>;
}

export function mintKey<TMeta, TCard extends Cardinality>(
	cardinality: TCard,
	label?: string
): MetadataKey<TMeta, InternalCardinalityOf<TCard>> {
	return (
		cardinality === "many" ? mintMetadataKey<TMeta>("list", label) : mintMetadataKey<TMeta>("unique", label)
	) as MetadataKey<TMeta, InternalCardinalityOf<TCard>>;
}

export interface NormalizedBuilderInput<TMeta, TArgs extends unknown[], TCard extends Cardinality> {
	cardinality: TCard;
	key: MetadataKey<TMeta, InternalCardinalityOf<TCard>>;
	options: DecoratorOptions<TMeta, TArgs> | undefined;
}

export function normalizeBuilderInput<TMeta, TArgs extends unknown[], TCard extends Cardinality>(
	input: BuilderInput<TMeta, TArgs, TCard>
): NormalizedBuilderInput<TMeta, TArgs, TCard> {
	const cardinality = resolveCardinality<TMeta, TArgs, TCard>(input);
	const options = toLegacyOptions<TMeta, TArgs, TCard>(input);
	const key = mintKey<TMeta, TCard>(cardinality, options?.name);
	return { cardinality, key, options };
}
