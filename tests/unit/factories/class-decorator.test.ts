import { describe, expect, test } from "bun:test";

// Temporary: importing directly until Phase M1 consolidates all factory exports into src/index.ts.
import { AnnotateError } from "../../../src/errors";
import { createClassDecorator } from "../../../src/factories/class-decorator";

describe("createClassDecorator (Stage-3)", () => {
	test("stores metadata via class decorator application", () => {
		const Tag = createClassDecorator<string>();

		@Tag("svc")
		class Service {}

		expect(Tag.metadata(Service)).toBe("svc");
		expect(Tag.applied(Service)).toBe(true);
		expect(Tag.appliedOwn(Service)).toBe(true);
	});

	test("supports compose for multi-arg call shapes", () => {
		const Component = createClassDecorator({
			compose: (selector: string, scoped: boolean) => ({ selector, scoped }),
		});

		@Component("app-root", true)
		class Root {}

		expect(Component.metadata(Root)).toEqual({ selector: "app-root", scoped: true });
	});

	test("appends per application; first wins on metadata()", () => {
		const Tag = createClassDecorator<string>();

		@Tag("outer")
		@Tag("inner")
		class X {}

		expect(Tag.reflect(X).class()?.metadata).toEqual(["inner", "outer"]);
		expect(Tag.metadata(X)).toBe("inner");
	});

	test("inheritance: child sees parent's class metadata via applied(); appliedOwn() does not", () => {
		const Tag = createClassDecorator<string>();

		@Tag("base")
		class Base {}
		class Child extends Base {}

		expect(Tag.applied(Child)).toBe(true);
		expect(Tag.appliedOwn(Child)).toBe(false);
		expect(Tag.metadata(Child)).toBe("base");
	});

	test("unique:true throws on second application to same class", () => {
		const Tag = createClassDecorator<string>({ unique: true, name: "Tag" });

		expect(() => {
			@Tag("a")
			@Tag("b")
			class X {}
			// biome-ignore lint/complexity/noVoid: discard class reference to avoid unused-variable warning in test
			void X;
		}).toThrow(AnnotateError);
	});

	test("requireMetadata throws AnnotateError(missing) when undecorated", () => {
		const Tag = createClassDecorator<string>({ name: "Tag" });

		class Bare {}
		expect(() => Tag.requireMetadata(Bare)).toThrow(AnnotateError);
	});
});
