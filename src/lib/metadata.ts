import type { MetadataArray, MetadataKey, ParameterMetadataMap } from "./types";
import "reflect-metadata";

/**
 * Get metadata from target, walking the prototype chain.
 */
export function getMetadata<T>(key: MetadataKey, target: object, propertyKey?: string | symbol): T | undefined {
	return propertyKey ? Reflect.getMetadata(key, target, propertyKey) : Reflect.getMetadata(key, target);
}

/**
 * Get metadata from target only (no prototype chain).
 */
export function getOwnMetadata<T>(key: MetadataKey, target: object, propertyKey?: string | symbol): T | undefined {
	return propertyKey ? Reflect.getOwnMetadata(key, target, propertyKey) : Reflect.getOwnMetadata(key, target);
}

/**
 * Get the metadata array for a key, or empty array if none.
 */
export function getMetadataArray<T>(key: MetadataKey, target: object, propertyKey?: string | symbol): MetadataArray<T> {
	return getOwnMetadata<MetadataArray<T>>(key, target, propertyKey) ?? [];
}

/**
 * Get the parameter metadata map for a key, or empty map if none.
 */
export function getParameterMap<T>(
	key: MetadataKey,
	target: object,
	propertyKey?: string | symbol,
): ParameterMetadataMap<T> {
	return getOwnMetadata<ParameterMetadataMap<T>>(key, target, propertyKey) ?? new Map();
}

/**
 * Define metadata on target.
 */
export function defineMetadata<T>(key: MetadataKey, value: T, target: object, propertyKey?: string | symbol): void {
	if (propertyKey) {
		Reflect.defineMetadata(key, value, target, propertyKey);
	} else {
		Reflect.defineMetadata(key, value, target);
	}
}

/**
 * Append a value to the metadata array for a key.
 */
export function appendMetadata<T>(key: MetadataKey, target: object, value: T, propertyKey?: string | symbol): void {
	const array = getMetadataArray<T>(key, target, propertyKey);
	array.push(value);
	defineMetadata(key, array, target, propertyKey);
}

/**
 * Store a parameter metadata map.
 */
export function setParameterMap<T>(
	key: MetadataKey,
	target: object,
	map: ParameterMetadataMap<T>,
	propertyKey?: string | symbol,
): void {
	defineMetadata(key, map, target, propertyKey);
}
