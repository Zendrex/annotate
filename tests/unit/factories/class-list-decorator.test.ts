/** biome-ignore-all lint/complexity/noVoid: discard class references to avoid unused-variable warnings in tests */
import { describe, expect, test } from "bun:test";

import { AnnotateError, decorate, reflect } from "../../../src";
import type { ListMetadataKey } from "../../../src";

describe("decorate.class.list", () => {
	test("returns a factory whose .key is assignable to ListMetadataKey<T>", () => {
		const Tag = decorate.class.list<string>();
		// Runtime shape check: key must exist and be a symbol
		expect(typeof Tag.key).toBe("symbol");

		// Type-level check via assignment (compile-time only, guarded below)
		const _check: ListMetadataKey<string> = Tag.key;
		void _check;
	});

	test("two classes decorated with the same .list factory each have 1 entry", () => {
		const Tag = decorate.class.list<string>();

		@Tag("alpha")
		class A {}

		@Tag("beta")
		class B {}

		expect(Tag.all(A)).toEqual(["alpha"]);
		expect(Tag.all(B)).toEqual(["beta"]);
	});

	test("one class decorated twice with same .list factory has 2 entries", () => {
		const Tag = decorate.class.list<string>();

		@Tag("first")
		@Tag("second")
		class X {}

		// Stage-3 applies outer first in source order (inner runs last at definition)
		expect(Tag.all(X)).toHaveLength(2);
		expect(Tag.all(X)).toContain("first");
		expect(Tag.all(X)).toContain("second");
	});

	test("entries visible via reflect().class(key)?.metadata", () => {
		const Tag = decorate.class.list<number>();

		@Tag(1)
		@Tag(2)
		class Counted {}

		const reflectedMeta = reflect(Counted).class(Tag.key)?.metadata;
		expect(reflectedMeta).toBeDefined();
		expect(reflectedMeta).toHaveLength(2);
		expect(reflectedMeta).toContain(1);
		expect(reflectedMeta).toContain(2);
	});

	test("first() returns the first-stored value", () => {
		const Tag = decorate.class.list<string>();

		// Stage-3: decorators run inner-to-outer at definition, so "inner" stores first
		@Tag("outer")
		@Tag("inner")
		class X {}

		expect(Tag.first(X)).toBe("inner");
	});

	test("does NOT throw DuplicateMetadataError on second application (unlike unique factory)", () => {
		const Tag = decorate.class.list<string>({ name: "ListTag" });

		expect(() => {
			@Tag("a")
			@Tag("b")
			class X {}
			void X;
		}).not.toThrow(AnnotateError);
	});

	test("derive() on a list factory shares the key and keeps list cardinality", () => {
		const Parent = decorate.class.list<string>({ name: "ListParent" });
		const Child = Parent.derive();

		expect(Parent.key).toBe(Child.key);

		@Parent("p")
		@Child("c")
		class X {}

		// Both entries visible via the parent reader
		expect(Parent.all(X)).toHaveLength(2);
		expect(Parent.all(X)).toContain("p");
		expect(Parent.all(X)).toContain("c");
	});

	test("has() and hasOwn() reflect list entries correctly", () => {
		const Tag = decorate.class.list<string>();

		@Tag("v")
		class Base {}
		class Sub extends Base {}

		expect(Tag.has(Sub)).toBe(true);
		expect(Tag.hasOwn(Sub)).toBe(false);
		expect(Tag.hasOwn(Base)).toBe(true);
	});

	test("inheritance: all() collects across chain", () => {
		const Tag = decorate.class.list<string>();

		@Tag("base")
		class Base {}

		@Tag("sub")
		class Sub extends Base {}

		expect(Tag.all(Sub)).toEqual(["sub", "base"]);
	});

	test("firstOrThrow() returns the first-stored value on a decorated class", () => {
		const Tag = decorate.class.list<string>();

		// Stage-3: inner decorator stores first (bottom-up application)
		@Tag("outer")
		@Tag("inner")
		class X {}

		expect(Tag.firstOrThrow(X)).toBe("inner");
	});

	test("firstOrThrow() throws MissingMetadataError on an undecorated class", () => {
		const Tag = decorate.class.list<string>();
		const Other = decorate.class.list<string>();

		@Other("o")
		class X {}

		expect(() => Tag.firstOrThrow(X)).toThrow(AnnotateError);
	});
});
