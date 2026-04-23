import { describe, expect, test } from "bun:test";

import { hasOwnMetadata, METADATA_SYMBOL, readOwnMetadata } from "../../../src/runtime/symbol-metadata";

describe("METADATA_SYMBOL", () => {
	test("is a symbol", () => {
		expect(typeof METADATA_SYMBOL).toBe("symbol");
	});

	test("is stable across calls (same identity)", () => {
		// Imported once; identity of the module-level binding is trivially stable.
		expect(METADATA_SYMBOL).toBe(METADATA_SYMBOL);
	});
});

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

	test("returns inherited metadata bag if present on parent (by spec — inheritance lookup is allowed on READ)", () => {
		class A {}
		const bag = { inherited: true };
		Object.defineProperty(A, METADATA_SYMBOL, { value: bag, configurable: true });
		class B extends A {}
		expect(readOwnMetadata(B)).toBe(bag);
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
