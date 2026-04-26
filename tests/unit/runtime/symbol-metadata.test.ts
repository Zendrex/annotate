import { describe, expect, test } from "bun:test";

import { hasOwnMetadata, METADATA_SYMBOL, readOwnMetadata } from "../../../src/runtime/symbol-metadata";

describe("readOwnMetadata", () => {
	test("returns null when symbol is absent", () => {
		class A {}
		expect(readOwnMetadata(A)).toBeNull();
	});

	test("returns the own metadata bag when present", () => {
		class A {}
		const bag = { marker: 1 };
		Object.defineProperty(A, METADATA_SYMBOL, { value: bag, configurable: true });
		expect(readOwnMetadata(A)).toBe(bag);
	});
});

describe("hasOwnMetadata", () => {
	test("false when the bag is inherited, not own", () => {
		class A {}
		const bag = {};
		Object.defineProperty(A, METADATA_SYMBOL, { value: bag, configurable: true });
		class B extends A {}
		expect(hasOwnMetadata(B)).toBe(false);
	});

	test("true when the bag is own", () => {
		class A {}
		const bag = {};
		Object.defineProperty(A, METADATA_SYMBOL, { value: bag, configurable: true });
		expect(hasOwnMetadata(A)).toBe(true);
	});

	test("false when no metadata anywhere", () => {
		class A {}
		expect(hasOwnMetadata(A)).toBe(false);
	});
});
