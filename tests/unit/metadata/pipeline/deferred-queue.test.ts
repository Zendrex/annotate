import { describe, expect, test } from "bun:test";

import { mintUniqueKey } from "../../../../src/metadata/cardinality";
import { flushFor, hasPendingFor, queueDeferred } from "../../../../src/metadata/pipeline";
import { getMemberMeta } from "../../../../src/metadata/store";

describe("metadata deferred queue", () => {
	test("queueDeferred + flushFor commits pending entries", () => {
		const correlation = {};
		const key = mintUniqueKey<string>("k");
		const token = Symbol("t");
		class A {}
		queueDeferred(correlation, {
			key,
			name: "foo",
			meta: "v",
			token,
			static: false,
			kind: "method",
		});
		expect(hasPendingFor(correlation)).toBe(true);
		flushFor(A, correlation);
		expect(hasPendingFor(correlation)).toBe(false);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
	});

	test("flushFor is idempotent (no double-write)", () => {
		const correlation = {};
		const key = mintUniqueKey<string>("k");
		const token = Symbol("t");
		class A {}
		queueDeferred(correlation, {
			key,
			name: "foo",
			meta: "v",
			token,
			static: false,
			kind: "method",
		});
		flushFor(A, correlation);
		flushFor(A, correlation);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
	});
});
