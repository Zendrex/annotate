import { describe, expect, test } from "bun:test";

import { AnnotateError, decorate, UnregisteredClassError } from "../../../src";

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

	test("appends per application; first wins on metadata()", () => {
		const Tag = decorate.class<string>();

		@Tag("outer")
		@Tag("inner")
		class X {}

		expect(Tag.reader(X).class()?.metadata).toEqual(["inner", "outer"]);
		expect(Tag.first(X)).toBe("inner");
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

	test("unique:true throws on second application to same class", () => {
		const Tag = decorate.class<string>({ unique: true, name: "Tag" });

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

	test("firstOrThrow throws AnnotateError(missing) when class registered but factory not applied", () => {
		const Tag = decorate.class<string>({ name: "Tag" });
		const Other = decorate.class<string>({ name: "Other" });

		@Other("o")
		class X {}

		expect(() => Tag.firstOrThrow(X)).toThrow(AnnotateError);
		expect(() => Tag.firstOrThrow(X)).not.toThrow(UnregisteredClassError);
	});
});
