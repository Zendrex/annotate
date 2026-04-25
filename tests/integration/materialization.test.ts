/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
import { describe, expect, test } from "bun:test";

import { decorate } from "../../src";

describe("subclass-of-parent-only-decorated regression", () => {
	test("property: has / hasOwn / reader for child of decorated parent", () => {
		const Field = decorate.property<string>();
		class A {
			@Field("a")
			foo!: number;
		}
		class B extends A {}

		new B();
		expect(Field.hasOwn(A, "foo")).toBe(true);
		expect(Field.hasOwn(B, "foo")).toBe(false);
		expect(Field.has(B, "foo")).toBe(true);

		const props = Field.reader(B).properties();
		expect(props).toHaveLength(1);
		expect(props[0]?.name).toBe("foo");
	});

	test("token-dedup invariant across interleaved constructions", () => {
		const Field = decorate.property<string>();
		class A {
			@Field("a")
			foo!: number;
		}
		class B extends A {}

		for (let i = 0; i < 100; i++) {
			if (i % 3 === 0) {
				new A();
			} else {
				new B();
			}
		}
		const list = Field.reader(A).properties();
		// Unique-cardinality key: metadata is a scalar string value.
		expect(list[0]?.metadata).toBe("a");
		expect(Field.hasOwn(B, "foo")).toBe(false);
	});
});
