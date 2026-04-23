import { describe, expect, test } from "bun:test";

import { resolveDeclaringClass } from "../../../src/metadata/declaring-class";

const SYM = Symbol.metadata ?? Symbol.for("Symbol.metadata");

// biome-ignore lint/complexity/noBannedTypes: test helper accepts raw constructor identity.
function brand<T extends Function>(ctor: T, correlation: object): void {
	Object.defineProperty(ctor, SYM, { value: correlation, configurable: true });
}

describe("resolveDeclaringClass", () => {
	test("returns instance.constructor when correlation is nullish", () => {
		class A {}
		expect(resolveDeclaringClass(new A(), null)).toBe(A);
	});

	test("walks chain and returns the matching ancestor", () => {
		class A {}
		class B extends A {}
		const correlation = {};
		brand(A, correlation);
		expect(resolveDeclaringClass(new B(), correlation)).toBe(A);
	});

	test("returns the instance class when correlation matches it", () => {
		class A {}
		const correlation = {};
		brand(A, correlation);
		expect(resolveDeclaringClass(new A(), correlation)).toBe(A);
	});

	test("uses Object.hasOwn — does not match an inherited [Symbol.metadata]", () => {
		class A {}
		class B extends A {}
		const correlation = {};
		brand(A, correlation);
		// B inherits A's metadata bag through Object.create, but does not own one.
		expect(resolveDeclaringClass(new B(), correlation)).toBe(A);
	});

	test("falls back to instance.constructor when no link matches", () => {
		class A {}
		class B extends A {}
		const correlation = {};
		expect(resolveDeclaringClass(new B(), correlation)).toBe(B);
	});
});
