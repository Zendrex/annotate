import { describe, expect, test } from "bun:test";

import { mintUniqueKey } from "../../../src/metadata/cardinality-registry";
import { getMemberMeta } from "../../../src/metadata/member-meta-store";
import { registerCtor } from "../../../src/metadata/metadata-ctor-correlation";
import { flushFor, hasPendingFor, queueDeferred } from "../../../src/metadata/metadata-deferred-queue";
import { isFullyPrepared, markFullyPrepared } from "../../../src/metadata/prepared-sentinel";

describe("metadata deferred queue", () => {
	test("queueDeferred + flushFor commits pending entries", () => {
		const correlation = {};
		const key = mintUniqueKey("k");
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
		const key = mintUniqueKey("k");
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

	test("flushFor with nullish correlation is a no-op", () => {
		class A {}
		expect(() => flushFor(A, null)).not.toThrow();
	});

	test("queueDeferred invalidates the prepared sentinel for the registered ctor", () => {
		class A {}
		const correlation = {};
		registerCtor(A, correlation);
		markFullyPrepared(A);
		expect(isFullyPrepared(A)).toBe(true);

		queueDeferred(correlation, {
			key: mintUniqueKey("k"),
			name: "foo",
			meta: 1,
			token: Symbol("t"),
			static: false,
			kind: "method",
		});
		expect(isFullyPrepared(A)).toBe(false);
	});

	test("queueDeferred with nullish correlation is a no-op", () => {
		const key = mintUniqueKey("k");
		expect(() =>
			queueDeferred(null, {
				key,
				name: "x",
				meta: 1,
				token: Symbol("t"),
				static: false,
				kind: "method",
			})
		).not.toThrow();
	});
});
