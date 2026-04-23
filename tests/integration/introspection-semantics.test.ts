import { describe, expect, test } from "bun:test";

import { createPropertyDecorator, materialize } from "../../src";

describe("introspection semantics post-ensureProperty removal", () => {
	const Field = createPropertyDecorator<string>();

	class User {
		@Field("varchar")
		name!: string;

		@Field("int")
		age!: number;

		method(): string {
			return "x";
		}
	}

	test("'name' in User.prototype === false (no proto descriptor side effect)", () => {
		expect("name" in User.prototype).toBe(false);
		expect("age" in User.prototype).toBe(false);
		expect("method" in User.prototype).toBe(true);
	});

	test("Object.hasOwn(User.prototype, 'name') === false", () => {
		expect(Object.hasOwn(User.prototype, "name")).toBe(false);
		expect(Object.hasOwn(User.prototype, "age")).toBe(false);
	});

	test("Object.getOwnPropertyNames(User.prototype) excludes decorated fields, includes methods", () => {
		const names = Object.getOwnPropertyNames(User.prototype);
		expect(names).toContain("method");
		expect(names).toContain("constructor");
		expect(names).not.toContain("name");
		expect(names).not.toContain("age");
	});

	test("Object.hasOwn(instance, 'name') === true after construction (TS class-field emit)", () => {
		const u = new User();
		expect(Object.hasOwn(u, "name")).toBe(true);
		expect(Object.hasOwn(u, "age")).toBe(true);
	});

	test("Object.keys(instance) includes decorated-but-uninitialized fields", () => {
		const u = new User();
		const keys = Object.keys(u).sort();
		expect(keys).toEqual(["age", "name"]);
	});

	test("JSON.stringify(instance) omits undefined fields", () => {
		const u = new User();
		expect(JSON.parse(JSON.stringify(u))).toEqual({});
	});

	test("Field.applied(User, 'name') === true regardless of instantiation (with materialize)", () => {
		materialize(User);
		expect(Field.applied(User, "name")).toBe(true);
		expect(Field.applied(User, "age")).toBe(true);
		expect(Field.applied(User, "method")).toBe(false);
	});
});
