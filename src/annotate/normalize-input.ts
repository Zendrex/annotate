import { mintMetadataKey } from "../metadata/cardinality";
import type { MetadataKey } from "../metadata/types";
import type { AnyConstructor } from "../reflector/types";
import type { InternalAnnotationOptions, InternalCardinalityOf } from "./internal-types";
import type { Cardinality } from "./types";
import type { ValidatorFn } from "./validation-types";

export interface BuilderOptionsInput<TMeta, TArgs extends unknown[], TCard extends Cardinality> {
	args?: (...args: TArgs) => TMeta;
	cardinality?: TCard;
	label?: string;
	requires?: AnyConstructor;
	validate?: ValidatorFn<TMeta>;
}

export type BuilderInput<TMeta, TArgs extends unknown[], TCard extends Cardinality> =
	| ((...args: TArgs) => TMeta)
	| BuilderOptionsInput<TMeta, TArgs, TCard>
	| undefined;

export function resolveCardinality<TMeta, TArgs extends unknown[], TCard extends Cardinality>(
	input: BuilderInput<TMeta, TArgs, TCard>
): TCard {
	return (typeof input === "object" && input?.cardinality ? input.cardinality : "one") as TCard;
}

export function toAnnotationOptions<TMeta, TArgs extends unknown[], TCard extends Cardinality>(
	input: BuilderInput<TMeta, TArgs, TCard>
): InternalAnnotationOptions<TMeta, TArgs> | undefined {
	if (typeof input === "function") {
		return { args: input } as InternalAnnotationOptions<TMeta, TArgs>;
	}
	if (!input) {
		return;
	}
	const options: {
		args?: (...args: TArgs) => TMeta;
		label?: string;
		requires?: BuilderOptionsInput<TMeta, TArgs, TCard>["requires"];
		validate?: BuilderOptionsInput<TMeta, TArgs, TCard>["validate"];
	} = {};
	if (input.args) {
		options.args = input.args;
	}
	if (input.label !== undefined) {
		options.label = input.label;
	}
	if (input.requires) {
		options.requires = input.requires;
	}
	if (input.validate) {
		options.validate = input.validate;
	}
	return options as InternalAnnotationOptions<TMeta, TArgs>;
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
	options: InternalAnnotationOptions<TMeta, TArgs> | undefined;
}

export function normalizeBuilderInput<TMeta, TArgs extends unknown[], TCard extends Cardinality>(
	input: BuilderInput<TMeta, TArgs, TCard>
): NormalizedBuilderInput<TMeta, TArgs, TCard> {
	const cardinality = resolveCardinality<TMeta, TArgs, TCard>(input);
	const options = toAnnotationOptions<TMeta, TArgs, TCard>(input);
	const key = mintKey<TMeta, TCard>(cardinality, options?.label);
	return { cardinality, key, options };
}
