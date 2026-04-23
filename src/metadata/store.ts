import type { MetadataArray, MetadataKey, ParameterMetadataMap } from "./types";
import "reflect-metadata";

/** Walks prototype chain (class inheritance). */
export function getMetadata<T>(key: MetadataKey, target: object, propertyKey?: string | symbol): T | undefined {
	return propertyKey ? Reflect.getMetadata(key, target, propertyKey) : Reflect.getMetadata(key, target);
}

/** Does not walk prototype chain. */
export function getOwnMetadata<T>(key: MetadataKey, target: object, propertyKey?: string | symbol): T | undefined {
	return propertyKey ? Reflect.getOwnMetadata(key, target, propertyKey) : Reflect.getOwnMetadata(key, target);
}

/** Own metadata array for key, or empty array if none. */
export function getMetadataArray<T>(key: MetadataKey, target: object, propertyKey?: string | symbol): MetadataArray<T> {
	return getOwnMetadata<MetadataArray<T>>(key, target, propertyKey) ?? [];
}

/** Own parameter map for key, or empty Map if none. */
export function getParameterMap<T>(
	key: MetadataKey,
	target: object,
	propertyKey?: string | symbol
): ParameterMetadataMap<T> {
	return getOwnMetadata<ParameterMetadataMap<T>>(key, target, propertyKey) ?? new Map();
}

export function defineMetadata<T>(key: MetadataKey, value: T, target: object, propertyKey?: string | symbol): void {
	if (propertyKey) {
		Reflect.defineMetadata(key, value, target, propertyKey);
	} else {
		Reflect.defineMetadata(key, value, target);
	}
}

/**
 * Append value to own metadata array. Returns the updated array so callers
 * (e.g. interceptors) can consume it without a re-read.
 */
export function appendMetadata<T>(
	key: MetadataKey,
	target: object,
	value: T,
	propertyKey?: string | symbol
): MetadataArray<T> {
	const array = getMetadataArray<T>(key, target, propertyKey);
	array.push(value);
	defineMetadata(key, array, target, propertyKey);
	return array;
}

export function setParameterMap<T>(
	key: MetadataKey,
	target: object,
	map: ParameterMetadataMap<T>,
	propertyKey?: string | symbol
): void {
	defineMetadata(key, map, target, propertyKey);
}
