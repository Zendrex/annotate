import { describe, expect, test } from "bun:test";

import { prepare } from "../../src";
import { decorate } from "../../src/legacy";

describe("Field.has and prepare", () => {
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

	test("Field.has is true for decorated fields with prepare; false for undecorated method", () => {
		prepare(User);
		expect(Field.has(User, "name")).toBe(true);
		expect(Field.has(User, "age")).toBe(true);
		expect(Field.has(User, "method")).toBe(false);
	});
});
