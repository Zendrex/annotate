import { describe, expect, test } from "bun:test";

import { DuplicateMetadataError, UnregisteredMetadataKeyError } from "../../../../src/errors";
import { mintListKey, mintUniqueKey } from "../../../../src/metadata/cardinality";
import {
	appendClassMeta,
	collectClassMeta,
	getClassMeta,
	hasOwnAnyClassMeta,
	hasOwnClassMeta,
} from "../../../../src/metadata/stores/class-meta-store";
import type { MetadataKey } from "../../../../src/metadata/types";

describe("class metadata store", () => {
	test("returns empty array when no entries", () => {
		const key = mintUniqueKey("k");
		class A {}
		expect(getClassMeta(A, key)).toEqual([]);
		expect(hasOwnClassMeta(A, key)).toBe(false);
	});

	test("appendClassMeta accumulates entries in order for list keys", () => {
		const key = mintListKey<string>("k");
		class A {}
		appendClassMeta(A, key, "first");
		appendClassMeta(A, key, "second");
		expect(getClassMeta<string>(A, key)).toEqual(["first", "second"]);
		expect(hasOwnClassMeta(A, key)).toBe(true);
	});

	test("unique key throws DuplicateMetadataError on second application", () => {
		const key = mintUniqueKey("k");
		class A {}
		appendClassMeta(A, key, "first");
		expect(() => appendClassMeta(A, key, "second")).toThrow(DuplicateMetadataError);
	});

	test("unregistered bare symbol throws UnregisteredMetadataKeyError", () => {
		const key = Symbol("k") as unknown as MetadataKey<string, "unique">;
		class A {}
		expect(() => appendClassMeta(A, key, "v")).toThrow(UnregisteredMetadataKeyError);
	});

	test("isolates entries per class", () => {
		const key = mintListKey("k");
		class A {}
		class B {}
		appendClassMeta(A, key, "a");
		expect(getClassMeta(B, key)).toEqual([]);
	});
});

describe("collectClassMeta ancestor walk", () => {
	test("returns own entries when no ancestor data", () => {
		const key = mintListKey<string>("k");
		class A {}
		appendClassMeta(A, key, "a");
		expect(collectClassMeta<string>(A, key)).toEqual(["a"]);
	});

	test("most-derived-first concatenation", () => {
		const key = mintListKey<string>("k");
		class A {}
		class B extends A {}
		class C extends B {}
		appendClassMeta(A, key, "from-a");
		appendClassMeta(B, key, "from-b");
		appendClassMeta(C, key, "from-c");
		expect(collectClassMeta<string>(C, key)).toEqual(["from-c", "from-b", "from-a"]);
	});

	test("returns empty when no link in chain has entries", () => {
		const key = mintListKey("k");
		class A {}
		class B extends A {}
		expect(collectClassMeta(B, key)).toEqual([]);
	});
});

describe("hasOwnAnyClassMeta", () => {
	test("false when empty, true after append", () => {
		const key = mintUniqueKey("k");
		class A {}
		expect(hasOwnAnyClassMeta(A)).toBe(false);
		appendClassMeta(A, key, "x");
		expect(hasOwnAnyClassMeta(A)).toBe(true);
	});

	test("does not walk ancestors (own-only)", () => {
		const key = mintUniqueKey("k");
		class A {}
		class B extends A {}
		appendClassMeta(A, key, "a");
		expect(hasOwnAnyClassMeta(B)).toBe(false);
		expect(hasOwnAnyClassMeta(A)).toBe(true);
	});
});
