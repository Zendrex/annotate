import { describe, expect, test } from "bun:test";

import { applyFieldInterceptors, createFieldInterceptor } from "../../src/factories/field-interceptor";

// Reproduces the four-class arrangement (single A, B; multi Mixed; trailing D)
// that triggers Bun 1.3's addInit shadowing. Asserts `applyFieldInterceptors`
// restores per-field state on every class. See `createFieldInterceptor` for
// the underlying bug.

interface TagMeta {
	tag: string;
}

const TestField = createFieldInterceptor<TagMeta, [string], string>({
	compose: (tag) => ({ tag }),
	onInit(initial, readMetadata) {
		const meta = readMetadata(this as object)[0];
		return meta ? `resolved-${meta.tag}` : initial;
	},
});

class A {
	@TestField("a-field") readonly x!: string;
}
class B {
	@TestField("b-field") readonly x!: string;
}
class Mixed {
	@TestField("mixed-x") readonly x!: string;
	@TestField("mixed-y") readonly y!: string;
}
class D {
	@TestField("d-field") readonly x!: string;
}

describe("Bun 1.3 multi-field recovery via field.apply", () => {
	test("Mixed.y is recovered by applyFieldInterceptors", () => {
		const m = new Mixed();
		if (process.versions.bun) {
			expect(m.y).toBeUndefined();
		}
		applyFieldInterceptors(m);
		expect(m.x).toBe("resolved-mixed-x");
		expect(m.y).toBe("resolved-mixed-y");
	});

	test("single-field classes unaffected and still benefit from field.apply", () => {
		const a = new A();
		const b = new B();
		const d = new D();
		applyFieldInterceptors(a);
		applyFieldInterceptors(b);
		applyFieldInterceptors(d);
		expect(a.x).toBe("resolved-a-field");
		expect(b.x).toBe("resolved-b-field");
		expect(d.x).toBe("resolved-d-field");
	});

	test("field.apply is idempotent under repeated calls", () => {
		const m = new Mixed();
		applyFieldInterceptors(m);
		applyFieldInterceptors(m);
		applyFieldInterceptors(m);
		expect(m.x).toBe("resolved-mixed-x");
		expect(m.y).toBe("resolved-mixed-y");
	});
});
