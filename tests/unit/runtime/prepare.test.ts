import { describe, expect, test } from "bun:test";

import { UnregisteredClassError } from "../../../src/errors";
import { mintListKey, mintUniqueKey } from "../../../src/metadata/cardinality-registry";
import { getMemberMeta } from "../../../src/metadata/member-meta-store";
import { registerCtor } from "../../../src/metadata/metadata-ctor-correlation";
import { hasPendingFor, queueDeferred } from "../../../src/metadata/metadata-deferred-queue";
import { isFullyPrepared } from "../../../src/metadata/prepared-sentinel";
import { prepare } from "../../../src/runtime/prepare";
import { METADATA_SYMBOL } from "../../../src/runtime/symbol-metadata";

// biome-ignore lint/complexity/noBannedTypes: test helper.
function brand<T extends Function>(ctor: T, correlation: object): void {
	Object.defineProperty(ctor, METADATA_SYMBOL, { value: correlation, configurable: true });
}

describe("prepare(ctor)", () => {
	test("no-op when class has no correlation anywhere", () => {
		class A {}
		expect(() => prepare(A)).not.toThrow();
	});

	test("flushes pending Deferreds via cached correlation", () => {
		const key = mintUniqueKey<string>("k");
		const correlation = {};
		class A {}
		queueDeferred(correlation, {
			key,
			name: "foo",
			meta: "v",
			token: Symbol("token"),
			static: false,
			kind: "method",
		});
		registerCtor(A, correlation);
		prepare(A);
		expect(hasPendingFor(correlation)).toBe(false);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
	});

	test("flushes ancestor pending via prototype chain walk", () => {
		const key = mintUniqueKey<string>("k");
		const correlation = {};
		class A {}
		class B extends A {}
		brand(A, correlation);
		queueDeferred(correlation, {
			key,
			name: "foo",
			meta: "v",
			token: Symbol("token"),
			static: false,
			kind: "method",
		});
		prepare(B);
		// Pending was queued under A's correlation; chain walk finds A and flushes.
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
	});

	test("degraded path: own Symbol.metadata === undefined throws UnregisteredClassError", () => {
		class A {}
		Object.defineProperty(A, METADATA_SYMBOL, { value: undefined, configurable: true });
		expect(() => prepare(A)).toThrow(UnregisteredClassError);
	});

	test("repeat prepare on cached ctor short-circuits (no re-flush)", () => {
		const key = mintUniqueKey<string>("k");
		const correlation = {};
		class A {}
		const token = Symbol("token");
		queueDeferred(correlation, {
			key,
			name: "foo",
			meta: "v",
			token,
			static: false,
			kind: "method",
		});
		registerCtor(A, correlation);
		prepare(A);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);

		// The sentinel must have been set — this directly proves the short-circuit
		// path is wired up. If markFullyPrepared was never called, subsequent
		// prepare calls would re-enter the flush path on every invocation.
		expect(isFullyPrepared(A)).toBe(true);

		prepare(A);
		expect(hasPendingFor(correlation)).toBe(false);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
	});

	test("queueDeferred after fully-prepared invalidates sentinel; next prepare re-flushes", () => {
		const key = mintListKey<string>("k");
		const correlation = {};
		class A {}
		queueDeferred(correlation, {
			key,
			name: "foo",
			meta: "v1",
			token: Symbol("t1"),
			static: false,
			kind: "method",
		});
		registerCtor(A, correlation);
		prepare(A);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v1"]);

		// Enqueue new work AFTER prepare completed. Sentinel must be invalidated
		// by queueDeferred so the next prepare re-flushes the new entry.
		queueDeferred(correlation, {
			key,
			name: "foo",
			meta: "v2",
			token: Symbol("t2"),
			static: false,
			kind: "method",
		});
		expect(hasPendingFor(correlation)).toBe(true);
		prepare(A);
		expect(hasPendingFor(correlation)).toBe(false);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v1", "v2"]);
	});

	test("queueDeferred before registerCtor does not invalidate (no ctor yet); prepare drains normally", () => {
		const key = mintUniqueKey<string>("k");
		const correlation = {};
		class A {}
		// Enqueue first, then register: this is the typical decorator-time order.
		queueDeferred(correlation, {
			key,
			name: "foo",
			meta: "v",
			token: Symbol("t"),
			static: false,
			kind: "method",
		});
		registerCtor(A, correlation);
		prepare(A);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
		// Subsequent prepare is a no-op (sentinel set after first drain).
		prepare(A);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
	});

	test("chain-walk: prepare(B) with pending ancestor does NOT mark B as fully prepared", () => {
		const key = mintUniqueKey<string>("k");
		const correlation = {};
		class A {}
		class B extends A {}
		brand(A, correlation);
		queueDeferred(correlation, {
			key,
			name: "foo",
			meta: "v",
			token: Symbol("token"),
			static: false,
			kind: "method",
		});
		// B has no own metadata and no registered correlation — chain-walk fires for A.
		// The contract: B must NOT be marked fully prepared (only the ancestor that
		// held pending work is flushed; B itself may have further ancestors to drain).
		prepare(B);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
		expect(isFullyPrepared(B)).toBe(false);
	});

	test("chain-walk: subsequent prepare(B) drains newly queued ancestor work", () => {
		const key = mintListKey<string>("k");
		const correlation = {};
		class A {}
		class B extends A {}
		brand(A, correlation);
		queueDeferred(correlation, {
			key,
			name: "foo",
			meta: "v1",
			token: Symbol("t1"),
			static: false,
			kind: "method",
		});
		prepare(B);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v1"]);

		// Enqueue additional work under the same ancestor correlation after the
		// first prepare(B). prepare(B) must walk the chain again and flush it.
		queueDeferred(correlation, {
			key,
			name: "foo",
			meta: "v2",
			token: Symbol("t2"),
			static: false,
			kind: "method",
		});
		expect(hasPendingFor(correlation)).toBe(true);
		prepare(B);
		expect(hasPendingFor(correlation)).toBe(false);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v1", "v2"]);
	});
});
