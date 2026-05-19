/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
import { describe, expect, test } from "bun:test";

import { Annotate } from "../../src";

describe("subclass-of-parent-only-decorated regression", () => {
	test("selector reads and entries remain stable under interleaved construction", () => {
		const Field = Annotate.field<string>();
		class A {
			@Field("a")
			foo!: number;
		}
		class B extends A {}

		new B();
		expect(Field.read(A).get((target) => target.foo)).toBe("a");
		expect(Field.read(B).get((target) => target.foo)).toBe("a");

		const props = Field.read(B).fields();
		expect(props).toHaveLength(1);
		expect(props[0]?.name).toBe("foo");

		for (let i = 0; i < 100; i++) {
			if (i % 3 === 0) {
				new A();
			} else {
				new B();
			}
		}
		const list = Field.read(A).fields();
		expect(list[0]?.metadata).toBe("a");
		expect(Field.read(B).fields()).toHaveLength(1);
	});
});
