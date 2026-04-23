import { describe, expect, test } from "bun:test";

import {
	appendClassMeta,
	appendMemberMeta,
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
		expect(() => appendMemberMeta(A, key, "foo", "y", Symbol("t2"), { unique: true })).toThrow();
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
