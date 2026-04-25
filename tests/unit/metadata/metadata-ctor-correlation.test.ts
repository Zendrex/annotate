import { describe, expect, test } from "bun:test";

import {
	getCorrelationFor,
	registerCtor,
	resolveCtorFromMetadata,
} from "../../../src/metadata/metadata-ctor-correlation";

describe("metadata ctor correlation", () => {
	test("registerCtor maps both directions", () => {
		const correlation = {};
		class A {}
		registerCtor(A, correlation);
		expect(resolveCtorFromMetadata(correlation)).toBe(A);
		expect(getCorrelationFor(A)).toBe(correlation);
	});

	test("registerCtor is first-write-wins", () => {
		const correlation = {};
		class A {}
		class B {}
		registerCtor(A, correlation);
		registerCtor(B, correlation);
		expect(resolveCtorFromMetadata(correlation)).toBe(A);
	});
});
