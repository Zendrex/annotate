import { describe, expect, test } from "bun:test";

import { decorate, prepare } from "../../src";

describe("introspection semantics post-ensureProperty removal", () => {
	const Field = decorate.property<string>();

	class User {
		@Field("varchar")
		name!: string;

		@Field("int")
		age!: number;

		method(): string {
			return "x";
		}
	}

	test("decorated fields are not on prototype; methods are", () => {
		expect("name" in User.prototype).toBe(false);
		expect("age" in User.prototype).toBe(false);
		expect("method" in User.prototype).toBe(true);
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

	test("Field.has(User, 'name') === true regardless of instantiation (with prepare)", () => {
		prepare(User);
		expect(Field.has(User, "name")).toBe(true);
		expect(Field.has(User, "age")).toBe(true);
		expect(Field.has(User, "method")).toBe(false);
	});
});
