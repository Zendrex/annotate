// biome-ignore lint/complexity/noBannedTypes: constructor identity requires Function for prototype walk parity with src/metadata/store.ts.
type Ctor = Function;

// Symbol.metadata may be undefined in environments without Stage 3 decorator support.
// Fall back to a well-known global symbol so tests and runtime share the same key.
const METADATA_SYM: symbol = Symbol.metadata ?? Symbol.for("Symbol.metadata");

/**
 * Walk the constructor prototype chain from `instance.constructor` upward,
 * returning the first ancestor whose **own** `[Symbol.metadata]` matches
 * `correlation`. Falls back to `instance.constructor` when `correlation` is
 * nullish or unmatched.
 *
 * The own-bag check (`Object.hasOwn`) is essential: tslib installs each class's
 * metadata bag as `Object.create(super[Symbol.metadata])`, so an inherited-only
 * read leaks the parent's bag through `ctor[Symbol.metadata]`. Without the
 * guard, `class B extends A {}` (no decorations on B) would match A's
 * correlation at the B link and return B incorrectly.
 */
export function resolveDeclaringClass(instance: object, correlation: object | null): Ctor {
	const start = (instance as { constructor: Ctor }).constructor;
	if (!correlation) {
		return start;
	}
	let ctor: Ctor | null = start;
	while (ctor && ctor !== Function.prototype) {
		if (
			Object.hasOwn(ctor, METADATA_SYM) &&
			(ctor as unknown as Record<symbol, object | undefined>)[METADATA_SYM] === correlation
		) {
			return ctor;
		}
		ctor = Object.getPrototypeOf(ctor) as Ctor | null;
	}
	return start;
}
