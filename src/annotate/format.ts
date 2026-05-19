import type { Cardinality, ReadResult } from "./types";

export function formatRead<TMeta, TCard extends Cardinality>(
	values: readonly TMeta[],
	cardinality: TCard
): ReadResult<TMeta, TCard> {
	if (cardinality === "many") {
		return Object.freeze([...values]) as ReadResult<TMeta, TCard>;
	}
	return values[0] as ReadResult<TMeta, TCard>;
}

export function formatMetadata<TMeta, TCard extends Cardinality>(
	values: readonly unknown[],
	cardinality: TCard
): TCard extends "many" ? readonly TMeta[] : TMeta {
	if (cardinality === "many") {
		return Object.freeze([...values]) as TCard extends "many" ? readonly TMeta[] : TMeta;
	}
	return values[0] as TCard extends "many" ? readonly TMeta[] : TMeta;
}
