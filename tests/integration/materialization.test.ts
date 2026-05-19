/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
import { describe, expect, test } from "bun:test";

import { createPropertyDecorator } from "../../src/factories/property-decorator";

describe("subclass-of-parent-only-decorated regression", () => {
	test("has/hasOwn/reader + token dedup under interleaved construction", () => {
		const Field = createPropertyDecorator<string>();
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

		for (let i = 0; i < 100; i++) {
			if (i % 3 === 0) {
				new A();
			} else {
				new B();
			}
		}
		const list = Field.reader(A).properties();
		expect(list[0]?.metadata).toBe("a");
		expect(Field.hasOwn(B, "foo")).toBe(false);
	});
});
