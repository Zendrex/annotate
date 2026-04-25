import { describe, expect, test } from "bun:test";

import { DuplicateMetadataError } from "../../../src/errors";
import {
	appendMemberMeta,
	collectMemberMeta,
	collectMemberNames,
	getMemberMeta,
	hasAnyMemberMeta,
	hasOwnMemberMeta,
} from "../../../src/metadata/member-meta-store";

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
		appendMemberMeta(A, key, "foo", "x", tokenA, { unique: false, static: false, kind: "method" });
		appendMemberMeta(A, key, "foo", "y", tokenB, { unique: false, static: false, kind: "method" });
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["x", "y"]);
		expect(hasOwnMemberMeta(A, key, "foo")).toBe(true);
		expect(hasOwnMemberMeta(A, key, "bar")).toBe(false);
	});

	test("token dedups repeated commits of the same decoration", () => {
		const key = Symbol("k");
		const token = Symbol("token");
		class A {}
		appendMemberMeta(A, key, "foo", "v", token, { unique: false, static: false, kind: "method" });
		appendMemberMeta(A, key, "foo", "v", token, { unique: false, static: false, kind: "method" });
		appendMemberMeta(A, key, "foo", "v", token, { unique: false, static: false, kind: "method" });
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
	});

	test("unique:true throws on second distinct decoration of same name", () => {
		const key = Symbol("k");
		class A {}
		appendMemberMeta(A, key, "foo", "x", Symbol("t1"), { unique: true, static: false, kind: "method" });
		expect(() =>
			appendMemberMeta(A, key, "foo", "y", Symbol("t2"), { unique: true, static: false, kind: "method" })
		).toThrow(DuplicateMetadataError);
	});

	test("isolates entries per ctor (no prototype walk on read)", () => {
		const key = Symbol("k");
		class Parent {}
		class Child extends Parent {}
		appendMemberMeta(Parent, key, "foo", "p", Symbol("t"), { unique: false, static: false, kind: "method" });
		expect(getMemberMeta(Child, key, "foo")).toEqual([]);
		expect(hasOwnMemberMeta(Child, key, "foo")).toBe(false);
	});
});

describe("collectMemberMeta ancestor walk", () => {
	test("returns own entries when no ancestor data", () => {
		const key = Symbol("k");
		class A {}
		appendMemberMeta(A, key, "foo", "a", Symbol("t"), { unique: false, static: false, kind: "method" });
		expect(collectMemberMeta<string>(A, key, "foo")).toEqual(["a"]);
	});

	test("most-derived-first concatenation, no shadow", () => {
		const key = Symbol("k");
		class A {}
		class B extends A {}
		class C extends B {}
		appendMemberMeta(A, key, "foo", "from-a", Symbol("ta"), { unique: false, static: false, kind: "method" });
		appendMemberMeta(B, key, "foo", "from-b", Symbol("tb"), { unique: false, static: false, kind: "method" });
		appendMemberMeta(C, key, "foo", "from-c1", Symbol("tc1"), { unique: false, static: false, kind: "method" });
		appendMemberMeta(C, key, "foo", "from-c2", Symbol("tc2"), { unique: false, static: false, kind: "method" });
		expect(collectMemberMeta<string>(C, key, "foo")).toEqual(["from-c1", "from-c2", "from-b", "from-a"]);
	});

	test("returns empty when no link in chain has entries for the name", () => {
		const key = Symbol("k");
		class A {}
		class B extends A {}
		expect(collectMemberMeta(B, key, "foo")).toEqual([]);
	});
});

describe("collectMemberNames ancestor walk", () => {
	test("returns empty set when no entries", () => {
		const key = Symbol("k");
		class A {}
		expect(collectMemberNames(A, key).size).toBe(0);
	});

	test("unions names across chain without duplicates", () => {
		const key = Symbol("k");
		class A {}
		class B extends A {}
		appendMemberMeta(A, key, "a", "x", Symbol("t1"), { unique: false, static: false, kind: "method" });
		appendMemberMeta(B, key, "b", "y", Symbol("t2"), { unique: false, static: false, kind: "method" });
		appendMemberMeta(B, key, "a", "z", Symbol("t3"), { unique: false, static: false, kind: "method" });
		const names = collectMemberNames(B, key);
		expect(names.size).toBe(2);
		expect(names.has("a")).toBe(true);
		expect(names.has("b")).toBe(true);
	});
});

describe("hasAnyMemberMeta", () => {
	test("false when empty, true after append", () => {
		const key = Symbol("k");
		class A {}
		expect(hasAnyMemberMeta(A)).toBe(false);
		appendMemberMeta(A, key, "foo", "v", Symbol("t"), { unique: false, static: false, kind: "method" });
		expect(hasAnyMemberMeta(A)).toBe(true);
	});

	test("walks ancestors", () => {
		const key = Symbol("k");
		class A {}
		class B extends A {}
		appendMemberMeta(A, key, "foo", "v", Symbol("t"), { unique: false, static: false, kind: "method" });
		expect(hasAnyMemberMeta(B)).toBe(true);
	});

	test("stops at Function.prototype", () => {
		class A {}
		expect(() => hasAnyMemberMeta(A)).not.toThrow();
	});
});
