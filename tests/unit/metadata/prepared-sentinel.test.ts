import { describe, expect, test } from "bun:test";

import { registerCtor } from "../../../src/metadata/metadata-ctor-correlation";
import { invalidatePreparedFor, isFullyPrepared, markFullyPrepared } from "../../../src/metadata/prepared-sentinel";

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

	test("invalidatePreparedFor drops sentinel for the registered ctor", () => {
		class A {}
		const correlation = {};
		registerCtor(A, correlation);
		markFullyPrepared(A);
		expect(isFullyPrepared(A)).toBe(true);

		invalidatePreparedFor(correlation);
		expect(isFullyPrepared(A)).toBe(false);
	});

	test("invalidatePreparedFor is a no-op when correlation has no ctor yet", () => {
		const correlation = {};
		// No registerCtor call; invalidation should silently do nothing.
		expect(() => invalidatePreparedFor(correlation)).not.toThrow();
	});

	test("invalidatePreparedFor only drops the ctor mapped to that correlation", () => {
		class A {}
		class B {}
		const correlationA = {};
		const correlationB = {};
		registerCtor(A, correlationA);
		registerCtor(B, correlationB);
		markFullyPrepared(A);
		markFullyPrepared(B);

		invalidatePreparedFor(correlationA);
		expect(isFullyPrepared(A)).toBe(false);
		expect(isFullyPrepared(B)).toBe(true);
	});
});
