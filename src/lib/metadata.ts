import type { MetadataArray, MetadataKey, ParameterMetadataMap } from "./types";
import "reflect-metadata";

/**
 * Retrieves metadata, including inherited values from the prototype chain.
 *
 * Enables decorator metadata inheritance from parent classes.
 *
 * @typeParam T - The expected type of the metadata value
 * @param key - The unique symbol key identifying the metadata
 * @param target - The object to retrieve metadata from
 * @param propertyKey - Optional property or method name to scope the lookup
 * @returns The metadata value if found, or `undefined` if not present
 */
export function getMetadata<T>(key: MetadataKey, target: object, propertyKey?: string | symbol): T | undefined {
	return propertyKey ? Reflect.getMetadata(key, target, propertyKey) : Reflect.getMetadata(key, target);
}

/**
 * Retrieves metadata defined directly on the target (no prototype chain).
 *
 * Useful for checking whether a decorator was applied directly vs. inherited.
 *
 * @typeParam T - The expected type of the metadata value
 * @param key - The unique symbol key identifying the metadata
 * @param target - The object to retrieve metadata from
 * @param propertyKey - Optional property or method name to scope the lookup
 * @returns The metadata value if found, or `undefined` if not present
 */
export function getOwnMetadata<T>(key: MetadataKey, target: object, propertyKey?: string | symbol): T | undefined {
	return propertyKey ? Reflect.getOwnMetadata(key, target, propertyKey) : Reflect.getOwnMetadata(key, target);
}

/**
 * Retrieves the metadata array for a key, or an empty array if none exists.
 *
 * Always returns an array, even if no metadata has been stored.
 * Does not walk the prototype chain.
 *
 * @typeParam T - The type of elements in the metadata array
 * @param key - The unique symbol key identifying the metadata
 * @param target - The object to retrieve metadata from
 * @param propertyKey - Optional property or method name to scope the lookup
 * @returns The metadata array if found, or an empty array if not present
 */
export function getMetadataArray<T>(key: MetadataKey, target: object, propertyKey?: string | symbol): MetadataArray<T> {
	return getOwnMetadata<MetadataArray<T>>(key, target, propertyKey) ?? [];
}

/**
 * Retrieves the parameter metadata map for a key, or an empty map if none exists.
 *
 * Always returns a Map keyed by zero-based parameter index.
 * Does not walk the prototype chain.
 *
 * @typeParam T - The type of metadata stored for each parameter
 * @param key - The unique symbol key identifying the metadata
 * @param target - The object to retrieve metadata from
 * @param propertyKey - Optional property or method name to scope the lookup
 * @returns The parameter map if found, or an empty Map if not present
 */
export function getParameterMap<T>(
	key: MetadataKey,
	target: object,
	propertyKey?: string | symbol
): ParameterMetadataMap<T> {
	return getOwnMetadata<ParameterMetadataMap<T>>(key, target, propertyKey) ?? new Map();
}

/**
 * Stores metadata on a target under the given key.
 *
 * @typeParam T - The type of the metadata value
 * @param key - The unique symbol key identifying the metadata
 * @param value - The metadata value to store
 * @param target - The object to store metadata on
 * @param propertyKey - Optional property or method name to scope the storage
 */
export function defineMetadata<T>(key: MetadataKey, value: T, target: object, propertyKey?: string | symbol): void {
	if (propertyKey) {
		Reflect.defineMetadata(key, value, target, propertyKey);
	} else {
		Reflect.defineMetadata(key, value, target);
	}
}

/**
 * Appends a value to the metadata array for a key.
 *
 * Retrieves the existing array (or creates a new one), pushes the value,
 * and stores the updated array. Multiple decorators of the same type
 * accumulate metadata in application order.
 *
 * @typeParam T - The type of elements in the metadata array
 * @param key - The unique symbol key identifying the metadata
 * @param target - The object to store metadata on
 * @param value - The metadata value to append
 * @param propertyKey - Optional property or method name to scope the storage
 */
export function appendMetadata<T>(key: MetadataKey, target: object, value: T, propertyKey?: string | symbol): void {
	const array = getMetadataArray<T>(key, target, propertyKey);
	array.push(value);
	defineMetadata(key, array, target, propertyKey);
}

/**
 * Stores a parameter metadata map on a target.
 *
 * @typeParam T - The type of metadata stored for each parameter
 * @param key - The unique symbol key identifying the metadata
 * @param target - The object to store metadata on
 * @param map - The parameter metadata map to store
 * @param propertyKey - Optional property or method name to scope the storage
 */
export function setParameterMap<T>(
	key: MetadataKey,
	target: object,
	map: ParameterMetadataMap<T>,
	propertyKey?: string | symbol
): void {
	defineMetadata(key, map, target, propertyKey);
}
