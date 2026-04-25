import { describe, expect, test } from "bun:test";

import { DuplicateMetadataError } from "../../../src/errors";
import {
	appendClassMeta,
	collectClassMeta,
	getClassMeta,
	hasAnyClassMeta,
	hasOwnClassMeta,
} from "../../../src/metadata/class-meta-store";

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
		expect(() => appendClassMeta(A, key, "second", { unique: true })).toThrow(DuplicateMetadataError);
	});

	test("isolates entries per class", () => {
		const key = Symbol("k");
		class A {}
		class B {}
		appendClassMeta(A, key, "a", { unique: false });
		expect(getClassMeta(B, key)).toEqual([]);
	});
});

describe("collectClassMeta ancestor walk", () => {
	test("returns own entries when no ancestor data", () => {
		const key = Symbol("k");
		class A {}
		appendClassMeta(A, key, "a", { unique: false });
		expect(collectClassMeta<string>(A, key)).toEqual(["a"]);
	});

	test("most-derived-first concatenation", () => {
		const key = Symbol("k");
		class A {}
		class B extends A {}
		class C extends B {}
		appendClassMeta(A, key, "from-a", { unique: false });
		appendClassMeta(B, key, "from-b", { unique: false });
		appendClassMeta(C, key, "from-c", { unique: false });
		expect(collectClassMeta<string>(C, key)).toEqual(["from-c", "from-b", "from-a"]);
	});

	test("returns empty when no link in chain has entries", () => {
		const key = Symbol("k");
		class A {}
		class B extends A {}
		expect(collectClassMeta(B, key)).toEqual([]);
	});
});

describe("hasAnyClassMeta", () => {
	test("false when empty, true after append", () => {
		const key = Symbol("k");
		class A {}
		expect(hasAnyClassMeta(A)).toBe(false);
		appendClassMeta(A, key, "x", { unique: false });
		expect(hasAnyClassMeta(A)).toBe(true);
	});

	test("walks ancestors", () => {
		const key = Symbol("k");
		class A {}
		class B extends A {}
		appendClassMeta(A, key, "a", { unique: false });
		expect(hasAnyClassMeta(B)).toBe(true);
	});

	test("stops at Function.prototype", () => {
		class A {}
		expect(() => hasAnyClassMeta(A)).not.toThrow();
	});
});
