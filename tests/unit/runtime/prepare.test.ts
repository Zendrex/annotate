import { describe, expect, test } from "bun:test";

import { UnregisteredClassError } from "../../../src/errors";
import { mintUniqueKey } from "../../../src/metadata/cardinality-registry";
import { getMemberMeta } from "../../../src/metadata/member-meta-store";
import { registerCtor } from "../../../src/metadata/metadata-ctor-correlation";
import { hasPendingFor, queueDeferred } from "../../../src/metadata/metadata-deferred-queue";
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
		const key = mintUniqueKey("k");
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
		const key = mintUniqueKey("k");
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
});
