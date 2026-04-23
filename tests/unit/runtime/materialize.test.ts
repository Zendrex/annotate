import { describe, expect, test } from "bun:test";

import { UnregisteredClassError } from "../../../src/errors";
import {
	getCorrelationFor,
	getMemberMeta,
	hasPendingFor,
	queueDeferred,
	registerCtor,
} from "../../../src/metadata/store";
import { materialize } from "../../../src/runtime/materialize";
import { METADATA_SYMBOL } from "../../../src/runtime/symbol-metadata";

// biome-ignore lint/complexity/noBannedTypes: test helper.
function brand<T extends Function>(ctor: T, correlation: object): void {
	Object.defineProperty(ctor, METADATA_SYMBOL, { value: correlation, configurable: true });
}

describe("materialize(ctor)", () => {
	test("no-op when class has no correlation anywhere", () => {
		class A {}
		expect(() => materialize(A)).not.toThrow();
	});

	test("flushes pending Deferreds via cached correlation", () => {
		const key = Symbol("k");
		const correlation = {};
		class A {}
		queueDeferred(correlation, { key, name: "foo", meta: "v", token: Symbol("token"), unique: false });
		registerCtor(A, correlation);
		materialize(A);
		expect(hasPendingFor(correlation)).toBe(false);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
	});

	test("flushes pending Deferreds via own [Symbol.metadata]", () => {
		const key = Symbol("k");
		const correlation = {};
		class A {}
		brand(A, correlation);
		queueDeferred(correlation, { key, name: "foo", meta: "v", token: Symbol("token"), unique: false });
		materialize(A);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
		expect(getCorrelationFor(A)).toBe(correlation);
	});

	test("flushes ancestor pending via prototype chain walk", () => {
		const key = Symbol("k");
		const correlation = {};
		class A {}
		class B extends A {}
		brand(A, correlation);
		queueDeferred(correlation, { key, name: "foo", meta: "v", token: Symbol("token"), unique: false });
		materialize(B);
		// Pending was queued under A's correlation; chain walk finds A and flushes.
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
	});

	test("idempotent on repeated calls", () => {
		const key = Symbol("k");
		const correlation = {};
		class A {}
		brand(A, correlation);
		queueDeferred(correlation, { key, name: "foo", meta: "v", token: Symbol("token"), unique: false });
		materialize(A);
		materialize(A);
		materialize(A);
		expect(getMemberMeta<string>(A, key, "foo")).toEqual(["v"]);
	});

	test("degraded path: own Symbol.metadata === undefined throws UnregisteredClassError", () => {
		class A {}
		Object.defineProperty(A, METADATA_SYMBOL, { value: undefined, configurable: true });
		expect(() => materialize(A)).toThrow(UnregisteredClassError);
	});
});
