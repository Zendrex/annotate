import { describe, expect, test } from "bun:test";

import {
	getCorrelationFor,
	registerCtor,
	resolveCtorFromMetadata,
} from "../../../src/metadata/metadata-ctor-correlation";

const DIFFERENT_CTOR_PATTERN = /different constructor/;
const DIFFERENT_CORRELATION_PATTERN = /different correlation/;

describe("metadata ctor correlation", () => {
	test("registerCtor maps both directions", () => {
		const correlation = {};
		class A {}
		registerCtor(A, correlation);
		expect(resolveCtorFromMetadata(correlation)).toBe(A);
		expect(getCorrelationFor(A)).toBe(correlation);
	});

	test("registerCtor is idempotent for the same (ctor, correlation) pair", () => {
		const correlation = {};
		class A {}
		registerCtor(A, correlation);
		expect(() => registerCtor(A, correlation)).not.toThrow();
		expect(resolveCtorFromMetadata(correlation)).toBe(A);
	});

	test("registerCtor throws when the correlation is already bound to a different ctor", () => {
		const correlation = {};
		class A {}
		class B {}
		registerCtor(A, correlation);
		expect(() => registerCtor(B, correlation)).toThrow(DIFFERENT_CTOR_PATTERN);
	});

	test("registerCtor throws when the ctor is already bound to a different correlation", () => {
		const correlationA = {};
		const correlationB = {};
		class A {}
		registerCtor(A, correlationA);
		expect(() => registerCtor(A, correlationB)).toThrow(DIFFERENT_CORRELATION_PATTERN);
	});

	test("registerCtor is a no-op when correlation is null", () => {
		class A {}
		expect(() => registerCtor(A, null)).not.toThrow();
		expect(getCorrelationFor(A)).toBeUndefined();
	});
});
