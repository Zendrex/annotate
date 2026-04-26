import { describe, expect, test } from "bun:test";

import { invalidatePrepared, isFullyPrepared, markFullyPrepared } from "../../../src/metadata/prepared-sentinel";

describe("prepared-sentinel", () => {
	test("isFullyPrepared returns false by default", () => {
		class A {}
		expect(isFullyPrepared(A)).toBe(false);
	});

	test("markFullyPrepared sets the sentinel", () => {
		class A {}
		markFullyPrepared(A);
		expect(isFullyPrepared(A)).toBe(true);
	});

	test("invalidatePrepared drops the sentinel for a marked ctor", () => {
		class A {}
		markFullyPrepared(A);
		expect(isFullyPrepared(A)).toBe(true);

		invalidatePrepared(A);
		expect(isFullyPrepared(A)).toBe(false);
	});

	test("invalidatePrepared is a no-op for an unmarked ctor", () => {
		class A {}
		expect(() => invalidatePrepared(A)).not.toThrow();
		expect(isFullyPrepared(A)).toBe(false);
	});

	test("invalidatePrepared targets only the supplied ctor", () => {
		class A {}
		class B {}
		markFullyPrepared(A);
		markFullyPrepared(B);

		invalidatePrepared(A);
		expect(isFullyPrepared(A)).toBe(false);
		expect(isFullyPrepared(B)).toBe(true);
	});
});
