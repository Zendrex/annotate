import { describe, expect, test } from "bun:test";

import { Annotate, prepare } from "../../src";

describe("Field.has and prepare", () => {
	const Field = Annotate.field<string>();

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
		expect(Field.read(User).get((target) => target.name) !== undefined).toBe(true);
		expect(Field.read(User).get((target) => target.age) !== undefined).toBe(true);
		expect(Field.read(User).get((target) => target.method) !== undefined).toBe(false);
	});
});
