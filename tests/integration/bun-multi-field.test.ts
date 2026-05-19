import { describe, expect, test } from "bun:test";

import { Annotate } from "../../src";

interface TagMeta {
	tag: string;
}

const TestField = Annotate.intercept.field<TagMeta, [string], string>({
	args: (tag) => ({ tag }),
	init(this: object, initial, ctx) {
		const metadata = ctx.get(this);
		return `${initial}:${metadata?.tag ?? "missing"}`;
	},
});

class A {
	@TestField("a-field") readonly x = "a";
}
class B {
	@TestField("b-field") readonly x = "b";
}
class Mixed {
	@TestField("mixed-x") readonly x = "x";
	@TestField("mixed-y") readonly y = "y";
}
class D {
	@TestField("d-field") readonly x = "d";
}

describe("Bun 1.3 multi-field recovery via Annotate field interceptors", () => {
	test("multiple decorated fields on one class each read their own metadata", () => {
		const m = new Mixed();

		expect(m.x).toBe("x:mixed-x");
		expect(m.y).toBe("y:mixed-y");
		expect(TestField.read(Mixed).get((target) => target.x)).toEqual({ tag: "mixed-x" });
		expect(TestField.read(Mixed).get((target) => target.y)).toEqual({ tag: "mixed-y" });
	});

	test("single-field classes retain isolated metadata", () => {
		expect(new A().x).toBe("a:a-field");
		expect(new B().x).toBe("b:b-field");
		expect(new D().x).toBe("d:d-field");
	});

	test("new instances apply field interceptors independently", () => {
		expect(new Mixed().x).toBe("x:mixed-x");
		expect(new Mixed().y).toBe("y:mixed-y");
	});
});
