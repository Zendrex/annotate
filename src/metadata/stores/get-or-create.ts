export function getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V;
export function getOrCreate<K extends object, V>(map: WeakMap<K, V>, key: K, factory: () => V): V;
export function getOrCreate<K, V>(map: Map<K, V> | WeakMap<K & object, V>, key: K, factory: () => V): V {
	// `has`/`get` instead of an `=== undefined` sentinel so callers may legitimately store `undefined`.
	const concrete = map as Map<K, V>;
	if (!concrete.has(key)) {
		concrete.set(key, factory());
	}
	return concrete.get(key) as V;
}
