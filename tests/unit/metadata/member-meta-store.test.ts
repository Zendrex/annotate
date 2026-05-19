import { describe, expect, test } from "bun:test";

import { DuplicateMetadataError, UnregisteredMetadataKeyError } from "../../../src/errors";
import { mintListKey, mintUniqueKey } from "../../../src/metadata/cardinality-registry";
import {
	appendMemberMeta,
	collectMemberMeta,
	collectMemberNames,
	getMemberMeta,
	getMemberStatic,
	hasOwnAnyMemberMeta,
	hasOwnMemberMeta,
	snapshotMembers,
} from "../../../src/metadata/member-meta-store";
import type { MetadataKey } from "../../../src/metadata/types";

describe("member metadata store", () => {
	test("returns empty array when missing", () => {
		const key = mintUniqueKey("k");
		class A {}
		expect(getMemberMeta(A, key, "foo")).toEqual([]);
		expect(hasOwnMemberMeta(A, key, "foo")).toBe(false);
	});

	test("appendMemberMeta accumulates per-name entries for list keys", () => {
		const key = mintListKey<string>("k");
		const tokenA = Symbol("tokenA");
		const tokenB = Symbol("tokenB");
		class A {}
		appendMemberMeta(A, key, "foo", "x", tokenA, { static: false, kind: "method" });
		appendMemberMeta(A, key, "foo", "y", tokenB, { static: false, kind: "method" });
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["x", "y"]);
		expect(hasOwnMemberMeta(A, key, "foo")).toBe(true);
		expect(hasOwnMemberMeta(A, key, "bar")).toBe(false);
	});

	test("token dedups repeated commits of the same decoration", () => {
		const key = mintListKey<string>("k");
		const token = Symbol("token");
		class A {}
		appendMemberMeta(A, key, "foo", "v", token, { static: false, kind: "method" });
		appendMemberMeta(A, key, "foo", "v", token, { static: false, kind: "method" });
		appendMemberMeta(A, key, "foo", "v", token, { static: false, kind: "method" });
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
	});

	test("unique key throws DuplicateMetadataError on second distinct decoration of same name", () => {
		const key = mintUniqueKey("k");
		class A {}
		appendMemberMeta(A, key, "foo", "x", Symbol("t1"), { static: false, kind: "method" });
		expect(() => appendMemberMeta(A, key, "foo", "y", Symbol("t2"), { static: false, kind: "method" })).toThrow(
			DuplicateMetadataError
		);
	});

	test("unregistered bare symbol throws UnregisteredMetadataKeyError", () => {
		const key = Symbol("k") as unknown as MetadataKey<string>;
		class A {}
		expect(() => appendMemberMeta(A, key, "foo", "v", Symbol("t"), { static: false, kind: "method" })).toThrow(
			UnregisteredMetadataKeyError
		);
	});

	test("isolates entries per ctor (no prototype walk on read)", () => {
		const key = mintListKey("k");
		class Parent {}
		class Child extends Parent {}
		appendMemberMeta(Parent, key, "foo", "p", Symbol("t"), { static: false, kind: "method" });
		expect(getMemberMeta(Child, key, "foo")).toEqual([]);
		expect(hasOwnMemberMeta(Child, key, "foo")).toBe(false);
	});
});

describe("collectMemberMeta ancestor walk", () => {
	test("returns own entries when no ancestor data", () => {
		const key = mintListKey<string>("k");
		class A {}
		appendMemberMeta(A, key, "foo", "a", Symbol("t"), { static: false, kind: "method" });
		expect(collectMemberMeta<string>(A, key, "foo")).toEqual(["a"]);
	});

	test("most-derived-first concatenation, no shadow", () => {
		const key = mintListKey<string>("k");
		class A {}
		class B extends A {}
		class C extends B {}
		appendMemberMeta(A, key, "foo", "from-a", Symbol("ta"), { static: false, kind: "method" });
		appendMemberMeta(B, key, "foo", "from-b", Symbol("tb"), { static: false, kind: "method" });
		appendMemberMeta(C, key, "foo", "from-c1", Symbol("tc1"), { static: false, kind: "method" });
		appendMemberMeta(C, key, "foo", "from-c2", Symbol("tc2"), { static: false, kind: "method" });
		expect(collectMemberMeta<string>(C, key, "foo")).toEqual(["from-c1", "from-c2", "from-b", "from-a"]);
	});

	test("returns empty when no link in chain has entries for the name", () => {
		const key = mintListKey("k");
		class A {}
		class B extends A {}
		expect(collectMemberMeta(B, key, "foo")).toEqual([]);
	});
});

describe("collectMemberNames ancestor walk", () => {
	test("returns empty set when no entries", () => {
		const key = mintListKey("k");
		class A {}
		expect(collectMemberNames(A, key).size).toBe(0);
	});

	test("unions names across chain without duplicates", () => {
		const key = mintListKey("k");
		class A {}
		class B extends A {}
		appendMemberMeta(A, key, "a", "x", Symbol("t1"), { static: false, kind: "method" });
		appendMemberMeta(B, key, "b", "y", Symbol("t2"), { static: false, kind: "method" });
		appendMemberMeta(B, key, "a", "z", Symbol("t3"), { static: false, kind: "method" });
		const names = collectMemberNames(B, key);
		expect(names.size).toBe(2);
		expect(names.has("a")).toBe(true);
		expect(names.has("b")).toBe(true);
	});
});

describe("getMemberStatic", () => {
	test("returns false when no entry exists for the (key, name)", () => {
		const key = mintListKey("k");
		class A {}
		expect(getMemberStatic(A, key, "missing")).toBe(false);
	});

	test("returns the static flag captured at first append", () => {
		const key = mintListKey("k");
		class A {}
		appendMemberMeta(A, key, "instance", "v", Symbol("t1"), { static: false, kind: "method" });
		appendMemberMeta(A, key, "klass", "v", Symbol("t2"), { static: true, kind: "method" });
		expect(getMemberStatic(A, key, "instance")).toBe(false);
		expect(getMemberStatic(A, key, "klass")).toBe(true);
	});

	test("walks the prototype chain and uses the most-derived defining link", () => {
		const key = mintListKey("k");
		class Parent {}
		class Child extends Parent {}
		appendMemberMeta(Parent, key, "foo", "p", Symbol("tp"), { static: true, kind: "method" });
		appendMemberMeta(Child, key, "foo", "c", Symbol("tc"), { static: false, kind: "method" });
		expect(getMemberStatic(Child, key, "foo")).toBe(false);
		expect(getMemberStatic(Parent, key, "foo")).toBe(true);
	});

	test("subsequent appends to the same (key, name) do not change the static flag", () => {
		const key = mintListKey("k");
		class A {}
		appendMemberMeta(A, key, "foo", "v1", Symbol("t1"), { static: false, kind: "method" });
		// Second append on the same entry: static is invariant, captured at first commit.
		appendMemberMeta(A, key, "foo", "v2", Symbol("t2"), { static: true, kind: "method" });
		expect(getMemberStatic(A, key, "foo")).toBe(false);
	});
});

describe("snapshotMembers", () => {
	test("returns empty map when no entries", () => {
		const key = mintListKey("k");
		class A {}
		const snapshot = snapshotMembers(A, key);
		expect(snapshot.size).toBe(0);
	});

	test("captures own entries with values and static flag", () => {
		const key = mintListKey<string>("k");
		class A {}
		appendMemberMeta(A, key, "instance", "v1", Symbol("t1"), { static: false, kind: "method" });
		appendMemberMeta(A, key, "klass", "v2", Symbol("t2"), { static: true, kind: "method" });
		const snapshot = snapshotMembers(A, key);
		expect(snapshot.size).toBe(2);
		expect(snapshot.get("instance")).toEqual({ kind: "method", static: false, values: ["v1"] });
		expect(snapshot.get("klass")).toEqual({ kind: "method", static: true, values: ["v2"] });
	});

	test("merges chain in subclass-first order", () => {
		const key = mintListKey<string>("k");
		class A {}
		class B extends A {}
		class C extends B {}
		appendMemberMeta(A, key, "foo", "from-a", Symbol("ta"), { static: false, kind: "method" });
		appendMemberMeta(B, key, "foo", "from-b", Symbol("tb"), { static: false, kind: "method" });
		appendMemberMeta(C, key, "foo", "from-c1", Symbol("tc1"), { static: false, kind: "method" });
		appendMemberMeta(C, key, "foo", "from-c2", Symbol("tc2"), { static: false, kind: "method" });
		const snapshot = snapshotMembers(C, key);
		expect(snapshot.get("foo")?.values).toEqual(["from-c1", "from-c2", "from-b", "from-a"]);
	});

	test("static flag taken from most-derived defining link", () => {
		const key = mintListKey("k");
		class Parent {}
		class Child extends Parent {}
		appendMemberMeta(Parent, key, "foo", "p", Symbol("tp"), { static: true, kind: "method" });
		appendMemberMeta(Child, key, "foo", "c", Symbol("tc"), { static: false, kind: "method" });
		expect(snapshotMembers(Child, key).get("foo")?.static).toBe(false);
		expect(snapshotMembers(Parent, key).get("foo")?.static).toBe(true);
	});

	test("unions distinct names across chain", () => {
		const key = mintListKey("k");
		class A {}
		class B extends A {}
		appendMemberMeta(A, key, "a", "x", Symbol("t1"), { static: false, kind: "method" });
		appendMemberMeta(B, key, "b", "y", Symbol("t2"), { static: false, kind: "method" });
		const snapshot = snapshotMembers(B, key);
		expect(snapshot.size).toBe(2);
		expect(snapshot.get("a")?.values).toEqual(["x"]);
		expect(snapshot.get("b")?.values).toEqual(["y"]);
	});

	test("returned values arrays are copies — mutation does not affect store", () => {
		const key = mintListKey<string>("k");
		class A {}
		appendMemberMeta(A, key, "foo", "v", Symbol("t"), { static: false, kind: "method" });
		const snapshot = snapshotMembers(A, key);
		const entry = snapshot.get("foo");
		entry?.values.push("mutated");
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
	});
});

describe("hasOwnAnyMemberMeta", () => {
	test("false when empty, true after append", () => {
		const key = mintUniqueKey("k");
		class A {}
		expect(hasOwnAnyMemberMeta(A)).toBe(false);
		appendMemberMeta(A, key, "foo", "v", Symbol("t"), { static: false, kind: "method" });
		expect(hasOwnAnyMemberMeta(A)).toBe(true);
	});

	test("does not walk ancestors (own-only)", () => {
		const key = mintUniqueKey("k");
		class A {}
		class B extends A {}
		appendMemberMeta(A, key, "foo", "v", Symbol("t"), { static: false, kind: "method" });
		expect(hasOwnAnyMemberMeta(B)).toBe(false);
		expect(hasOwnAnyMemberMeta(A)).toBe(true);
	});
});
