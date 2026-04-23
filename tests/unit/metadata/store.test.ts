import { describe, expect, test } from "bun:test";

import { appendClassMeta, getClassMeta, hasOwnClassMeta } from "../../../src/metadata/store";

describe("class metadata store", () => {
	test("returns empty array when no entries", () => {
		const key = Symbol("k");
		class A {}
		expect(getClassMeta(A, key)).toEqual([]);
		expect(hasOwnClassMeta(A, key)).toBe(false);
	});

	test("appendClassMeta accumulates entries in order", () => {
		const key = Symbol("k");
		class A {}
		appendClassMeta(A, key, "first", { unique: false });
		appendClassMeta(A, key, "second", { unique: false });
		expect(getClassMeta<string>(A, key)).toEqual(["first", "second"]);
		expect(hasOwnClassMeta(A, key)).toBe(true);
	});

	test("unique:true throws on second application", () => {
		const key = Symbol("k");
		class A {}
		appendClassMeta(A, key, "first", { unique: true });
		expect(() => appendClassMeta(A, key, "second", { unique: true })).toThrow();
	});

	test("isolates entries per class", () => {
		const key = Symbol("k");
		class A {}
		class B {}
		appendClassMeta(A, key, "a", { unique: false });
		expect(getClassMeta(B, key)).toEqual([]);
	});
});
