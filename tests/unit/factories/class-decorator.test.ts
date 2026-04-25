import { describe, expect, test } from "bun:test";

import { AnnotateError, decorate, MissingMetadataError, UnregisteredClassError } from "../../../src";

describe("decorate.class", () => {
	test("stores metadata via class decorator application", () => {
		const Tag = decorate.class<string>();

		@Tag("svc")
		class Service {}

		expect(Tag.first(Service)).toBe("svc");
		expect(Tag.has(Service)).toBe(true);
		expect(Tag.hasOwn(Service)).toBe(true);
	});

	test("supports compose for multi-arg call shapes", () => {
		const Component = decorate.class({
			compose: (selector: string, scoped: boolean) => ({ selector, scoped }),
		});

		@Component("app-root", true)
		class Root {}

		expect(Component.first(Root)).toEqual({ selector: "app-root", scoped: true });
	});

	test("single application; first returns the stored value", () => {
		const Tag = decorate.class<string>();

		@Tag("value")
		class X {}

		// Unique-cardinality key: reader metadata is a scalar string, not an array.
		expect(Tag.reader(X).class()?.metadata).toBe("value");
		expect(Tag.first(X)).toBe("value");
	});

	test("inheritance: subclass and base each hold one value; all() collects both", () => {
		const Tag = decorate.class<string>();

		@Tag("base")
		class Base {}

		@Tag("child")
		class Child extends Base {}

		expect(Tag.all(Child)).toEqual(["child", "base"]);
		expect(Tag.first(Child)).toBe("child");
	});

	test("inheritance: child sees parent's class metadata via has(); hasOwn() does not", () => {
		const Tag = decorate.class<string>();

		@Tag("base")
		class Base {}
		class Child extends Base {}

		expect(Tag.has(Child)).toBe(true);
		expect(Tag.hasOwn(Child)).toBe(false);
		expect(Tag.first(Child)).toBe("base");
	});

	test("throws DuplicateMetadataError on second application to same class (all factory keys are unique)", () => {
		const Tag = decorate.class<string>({ name: "Tag" });

		expect(() => {
			@Tag("a")
			@Tag("b")
			class X {}
			// biome-ignore lint/complexity/noVoid: discard class reference to avoid unused-variable warning in test
			void X;
		}).toThrow(AnnotateError);
	});

	test("first() throws UnregisteredClassError when class never decorated", () => {
		const Tag = decorate.class<string>({ name: "Tag" });

		class Bare {}
		expect(() => Tag.first(Bare)).toThrow(UnregisteredClassError);
	});

	test("firstOrThrow throws MissingMetadataError when class registered but factory not applied", () => {
		const Tag = decorate.class<string>({ name: "Tag" });
		const Other = decorate.class<string>({ name: "Other" });

		@Other("o")
		class X {}

		expect(() => Tag.firstOrThrow(X)).toThrow(MissingMetadataError);
		expect(() => Tag.firstOrThrow(X)).toThrow(AnnotateError);
		expect(() => Tag.firstOrThrow(X)).not.toThrow(UnregisteredClassError);
	});
});
