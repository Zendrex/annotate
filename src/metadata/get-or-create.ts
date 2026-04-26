/**
 * Retrieves or creates a value in a Map/WeakMap, calling the factory only if the key is absent.
 */
export function getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V;
export function getOrCreate<K extends object, V>(map: WeakMap<K, V>, key: K, factory: () => V): V;
export function getOrCreate<K, V>(map: Map<K, V> | WeakMap<K & object, V>, key: K, factory: () => V): V {
	let value = map.get(key as K & object);
	if (value === undefined) {
		value = factory();
		(map as Map<K, V>).set(key, value);
	}
	return value;
}
