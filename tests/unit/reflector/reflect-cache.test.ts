import { describe, expect, test } from "bun:test";

import { decorate, reflect } from "../../../src";

describe("reflect() per-ctor caching", () => {
	test("returns the same Reflector instance for repeated calls on the same ctor", () => {
		const Tag = decorate.class<string>();

		@Tag("a")
		class A {}

		const first = reflect(A);
		const second = reflect(A);

		expect(second).toBe(first);
	});

	test("returns the same Reflector for an instance and its constructor", () => {
		const Tag = decorate.class<string>();

		@Tag("a")
		class A {}

		const instance = new A();
		const fromInstance = reflect(instance);
		const fromCtor = reflect(A);

		expect(fromInstance).toBe(fromCtor);
	});

	test("returns distinct Reflector instances for different ctors", () => {
		const Tag = decorate.class<string>();

		@Tag("a")
		class A {}
		@Tag("b")
		class B {}

		expect(reflect(A)).not.toBe(reflect(B));
	});
});
