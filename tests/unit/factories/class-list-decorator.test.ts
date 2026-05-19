/** biome-ignore-all lint/complexity/noVoid: discard class references to avoid unused-variable warnings in tests */
import { describe, expect, test } from "bun:test";

import { AnnotateError, MissingMetadataError } from "../../../src";
import { createClassListDecorator } from "../../../src/factories/class-decorator";

describe("createClassListDecorator", () => {
	test("two classes decorated with the same .list factory each have 1 entry", () => {
		const Tag = createClassListDecorator<string>();

		@Tag("alpha")
		class A {}

		@Tag("beta")
		class B {}

		expect(Tag.all(A)).toEqual(["alpha"]);
		expect(Tag.all(B)).toEqual(["beta"]);
	});

	test("one class decorated twice with same .list factory has 2 entries", () => {
		const Tag = createClassListDecorator<string>();

		@Tag("first")
		@Tag("second")
		class X {}

		expect(Tag.all(X)).toHaveLength(2);
		expect(Tag.all(X)).toContain("first");
		expect(Tag.all(X)).toContain("second");
	});

	test("inheritance: all() collects across chain", () => {
		const Tag = createClassListDecorator<string>();

		@Tag("base")
		class Base {}

		@Tag("sub")
		class Sub extends Base {}

		expect(Tag.all(Sub)).toEqual(["sub", "base"]);
	});

	test("firstOrThrow() throws MissingMetadataError on an undecorated class", () => {
		const Tag = createClassListDecorator<string>();
		const Other = createClassListDecorator<string>();

		@Other("o")
		class X {}

		expect(() => Tag.firstOrThrow(X)).toThrow(MissingMetadataError);
		expect(() => Tag.firstOrThrow(X)).toThrow(AnnotateError);
	});
});
