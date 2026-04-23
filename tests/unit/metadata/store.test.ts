import { describe, expect, test } from "bun:test";

import { DuplicateMetadataError } from "../../../src/errors";
import {
	appendClassMeta,
	appendMemberMeta,
	collectMemberMeta,
	getClassMeta,
	getMemberMeta,
	hasOwnClassMeta,
	hasOwnMemberMeta,
} from "../../../src/metadata/store";

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

describe("member metadata store", () => {
	test("returns empty array when missing", () => {
		const key = Symbol("k");
		class A {}
		expect(getMemberMeta(A, key, "foo")).toEqual([]);
		expect(hasOwnMemberMeta(A, key, "foo")).toBe(false);
	});

	test("appendMemberMeta accumulates per-name entries", () => {
		const key = Symbol("k");
		const tokenA = Symbol("tokenA");
		const tokenB = Symbol("tokenB");
		class A {}
		appendMemberMeta(A, key, "foo", "x", tokenA, { unique: false });
		appendMemberMeta(A, key, "foo", "y", tokenB, { unique: false });
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["x", "y"]);
		expect(hasOwnMemberMeta(A, key, "foo")).toBe(true);
		expect(hasOwnMemberMeta(A, key, "bar")).toBe(false);
	});

	test("token dedups repeated commits of the same decoration", () => {
		const key = Symbol("k");
		const token = Symbol("token");
		class A {}
		appendMemberMeta(A, key, "foo", "v", token, { unique: false });
		appendMemberMeta(A, key, "foo", "v", token, { unique: false });
		appendMemberMeta(A, key, "foo", "v", token, { unique: false });
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
	});

	test("unique:true throws on second distinct decoration of same name", () => {
		const key = Symbol("k");
		class A {}
		appendMemberMeta(A, key, "foo", "x", Symbol("t1"), { unique: true });
		expect(() => appendMemberMeta(A, key, "foo", "y", Symbol("t2"), { unique: true })).toThrow(
			DuplicateMetadataError
		);
	});

	test("hasOwnMemberMeta is per-name, not per-factory-key", () => {
		const key = Symbol("k");
		class A {}
		appendMemberMeta(A, key, "bar", "v", Symbol("t"), { unique: false });
		expect(hasOwnMemberMeta(A, key, "foo")).toBe(false);
		expect(hasOwnMemberMeta(A, key, "bar")).toBe(true);
	});

	test("isolates entries per ctor (no prototype walk on read)", () => {
		const key = Symbol("k");
		class Parent {}
		class Child extends Parent {}
		appendMemberMeta(Parent, key, "foo", "p", Symbol("t"), { unique: false });
		expect(getMemberMeta(Child, key, "foo")).toEqual([]);
		expect(hasOwnMemberMeta(Child, key, "foo")).toBe(false);
	});
});

describe("collectMemberMeta ancestor walk", () => {
	test("returns own entries when no ancestor data", () => {
		const key = Symbol("k");
		class A {}
		appendMemberMeta(A, key, "foo", "a", Symbol("t"), { unique: false });
		expect(collectMemberMeta<string>(A, key, "foo")).toEqual(["a"]);
	});

	test("most-derived-first concatenation, no shadow", () => {
		const key = Symbol("k");
		class A {}
		class B extends A {}
		class C extends B {}
		appendMemberMeta(A, key, "foo", "from-a", Symbol("ta"), { unique: false });
		appendMemberMeta(B, key, "foo", "from-b", Symbol("tb"), { unique: false });
		appendMemberMeta(C, key, "foo", "from-c1", Symbol("tc1"), { unique: false });
		appendMemberMeta(C, key, "foo", "from-c2", Symbol("tc2"), { unique: false });
		expect(collectMemberMeta<string>(C, key, "foo")).toEqual(["from-c1", "from-c2", "from-b", "from-a"]);
	});

	test("returns empty when no link in chain has entries for the name", () => {
		const key = Symbol("k");
		class A {}
		class B extends A {}
		expect(collectMemberMeta(B, key, "foo")).toEqual([]);
	});

	test("stops at Function.prototype", () => {
		const key = Symbol("k");
		class A {}
		expect(() => collectMemberMeta(A, key, "missing")).not.toThrow();
	});
});
