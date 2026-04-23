import type { MetadataArray, MetadataKey, ParameterMetadataMap } from "./types";
import "reflect-metadata";

/**
 * Read metadata via `reflect-metadata`, walking the prototype chain so
 * subclasses observe inherited metadata.
 *
 * Prefer the factory-level helpers (`factory.metadata`, `factory.reflect`) for
 * consumer code; this function is exported for custom integrations that need
 * to share storage with foreign decorator systems.
 */
export function getMetadata<T>(key: MetadataKey, target: object, propertyKey?: string | symbol): T | undefined {
	return propertyKey ? Reflect.getMetadata(key, target, propertyKey) : Reflect.getMetadata(key, target);
}

/**
 * Read metadata defined directly on `target` without walking the prototype
 * chain. Use this to distinguish own metadata from inherited metadata.
 */
export function getOwnMetadata<T>(key: MetadataKey, target: object, propertyKey?: string | symbol): T | undefined {
	return propertyKey ? Reflect.getOwnMetadata(key, target, propertyKey) : Reflect.getOwnMetadata(key, target);
}

/**
 * Read the own metadata array for `key`, returning an empty array when absent.
 *
 * The returned array is the live storage array when metadata exists; callers
 * that mutate it are expected to re-define via {@link defineMetadata} to keep
 * `reflect-metadata` in a consistent state.
 */
export function getMetadataArray<T>(key: MetadataKey, target: object, propertyKey?: string | symbol): MetadataArray<T> {
	return getOwnMetadata<MetadataArray<T>>(key, target, propertyKey) ?? [];
}

/**
 * Read the own parameter metadata map for `key`, returning a fresh empty `Map`
 * when absent. The fresh map is not written back; use {@link setParameterMap}
 * after populating it.
 */
export function getParameterMap<T>(
	key: MetadataKey,
	target: object,
	propertyKey?: string | symbol
): ParameterMetadataMap<T> {
	return getOwnMetadata<ParameterMetadataMap<T>>(key, target, propertyKey) ?? new Map();
}

/** Define metadata on `target`, overwriting any prior value at the same key. */
export function defineMetadata<T>(key: MetadataKey, value: T, target: object, propertyKey?: string | symbol): void {
	if (propertyKey) {
		Reflect.defineMetadata(key, value, target, propertyKey);
	} else {
		Reflect.defineMetadata(key, value, target);
	}
}

/**
 * Append `value` to the own metadata array for `key`, creating the array when
 * needed.
 *
 * @returns The updated array, so callers (e.g. interceptors) can consume it
 *   without a re-read.
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

/** Persist a parameter metadata map for `key` on `target`. */
export function setParameterMap<T>(
	key: MetadataKey,
	target: object,
	map: ParameterMetadataMap<T>,
	propertyKey?: string | symbol
): void {
	defineMetadata(key, map, target, propertyKey);
}
