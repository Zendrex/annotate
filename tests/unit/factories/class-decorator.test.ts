/** biome-ignore-all lint/correctness/noUnusedVariables: decorators apply during class declaration */
import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { AnnotateError, createClassDecorator } from "../../../src";

describe("createClassDecorator", () => {
	test("should store simple metadata on class", () => {
		const Tag = createClassDecorator<string>();

		@Tag("admin")
		class Controller {}

		const one = Tag.reflect(Controller).class();
		expect(one).toBeDefined();
		expect(one?.kind).toBe("class");
		expect(one?.metadata).toEqual(["admin"]);
	});

	describe("metadata", () => {
		test("should return undefined for undecorated class", () => {
			const Tag = createClassDecorator<string>();

			class Plain {}

			expect(Tag.metadata(Plain)).toBeUndefined();
		});

		test("should return the value for a class decorated once", () => {
			const Tag = createClassDecorator<string>();

			@Tag("admin")
			class Controller {}

			expect(Tag.metadata(Controller)).toBe("admin");
		});

		test("should return the first applied value when decorated multiple times", () => {
			const Role = createClassDecorator<string>();

			@Role("admin")
			@Role("user")
			class Controller {}

			expect(Role.metadata(Controller)).toBe("user");
			expect(Role.reflect(Controller).class()?.metadata).toEqual(["user", "admin"]);
		});

		test("should inherit metadata from an ancestor class", () => {
			const Tag = createClassDecorator<string>();

			@Tag("parent")
			class Parent {}

			class Child extends Parent {}

			expect(Tag.metadata(Child)).toBe("parent");
		});

		test("should prefer own metadata over inherited", () => {
			const Tag = createClassDecorator<string>();

			@Tag("parent")
			class Parent {}

			@Tag("child")
			class Child extends Parent {}

			expect(Tag.metadata(Child)).toBe("child");
			expect(Tag.metadata(Parent)).toBe("parent");
		});

		test("should support compose functions", () => {
			const Permission = createClassDecorator({
				compose: (name: string, level: number) => ({ name, level }),
			});

			@Permission("write", 2)
			class Service {}

			expect(Permission.metadata(Service)).toEqual({ name: "write", level: 2 });
		});
	});

	describe("unique option", () => {
		test("should throw AnnotateError with name and target in the error message when applied twice to the same class", () => {
			const Once = createClassDecorator<string>({ unique: true, name: "Once" });

			try {
				@Once("second")
				@Once("first")
				class Dup {}
				throw new Error("expected AnnotateError");
			} catch (error) {
				expect(error).toBeInstanceOf(AnnotateError);
				const err = error as AnnotateError;
				expect(err.code).toBe("duplicate");
				expect(err.kind).toBe("class");
				expect(err.message).toContain("@Once");
				expect(err.message).toContain("Dup");
			}
		});

		test("should allow a subclass to re-decorate the same decorator", () => {
			const Once = createClassDecorator<string>({ unique: true });

			@Once("parent")
			class Parent {}

			expect(() => {
				@Once("child")
				class Child extends Parent {}
			}).not.toThrow();
		});

		test("should allow unrelated classes to each be decorated once", () => {
			const Once = createClassDecorator<string>({ unique: true });

			@Once("a")
			class A {}

			@Once("b")
			class B {}

			expect(Once.metadata(A)).toBe("a");
			expect(Once.metadata(B)).toBe("b");
		});

		test("should default to non-unique behavior when option omitted", () => {
			const Tag = createClassDecorator<string>();

			expect(() => {
				@Tag("two")
				@Tag("one")
				class Stacked {}
			}).not.toThrow();
		});
	});

	describe("requireMetadata", () => {
		test("should throw AnnotateError when metadata is absent", () => {
			const Tag = createClassDecorator<string>({ name: "Tag" });

			class Plain {}

			expect(() => Tag.requireMetadata(Plain)).toThrow(AnnotateError);
		});

		test("should include decorator name, target name, and code on the error", () => {
			const Tag = createClassDecorator<string>({ name: "Tag" });

			class Plain {}

			try {
				Tag.requireMetadata(Plain);
				throw new Error("expected AnnotateError");
			} catch (error) {
				expect(error).toBeInstanceOf(AnnotateError);
				const err = error as AnnotateError;
				expect(err.code).toBe("missing");
				expect(err.kind).toBe("class");
				expect(err.target).toBe(Plain);
				expect(err.message).toContain("@Tag");
				expect(err.message).toContain("Plain");
			}
		});
	});

	describe("applied", () => {
		test("should return false for undecorated class (applied and appliedOwn)", () => {
			const Tag = createClassDecorator<string>();

			class Plain {}

			expect(Tag.applied(Plain)).toBe(false);
			expect(Tag.appliedOwn(Plain)).toBe(false);
		});

		test("should return true for applied and appliedOwn when decorator applied on the class", () => {
			const Tag = createClassDecorator<string>();

			@Tag("admin")
			class Controller {}

			expect(Tag.applied(Controller)).toBe(true);
			expect(Tag.appliedOwn(Controller)).toBe(true);
		});

		test("should return true for subclass inheriting parent metadata", () => {
			const Tag = createClassDecorator<string>();

			@Tag("parent")
			class Parent {}

			class Child extends Parent {}

			expect(Tag.applied(Child)).toBe(true);
		});

		test("should not confuse separate decorators", () => {
			const A = createClassDecorator<string>();
			const B = createClassDecorator<string>();

			@A("x")
			class Target {}

			expect(A.applied(Target)).toBe(true);
			expect(B.applied(Target)).toBe(false);
		});
	});

	describe("appliedOwn", () => {
		test("should return false for subclass inheriting parent metadata only (appliedOwn)", () => {
			const Tag = createClassDecorator<string>();

			@Tag("parent")
			class Parent {}

			class Child extends Parent {}

			expect(Tag.appliedOwn(Child)).toBe(false);
			expect(Tag.appliedOwn(Parent)).toBe(true);
		});

		test("should return true when subclass carries its own decoration", () => {
			const Tag = createClassDecorator<string>();

			@Tag("parent")
			class Parent {}

			@Tag("child")
			class Child extends Parent {}

			expect(Tag.appliedOwn(Child)).toBe(true);
			expect(Tag.appliedOwn(Parent)).toBe(true);
		});
	});
});
