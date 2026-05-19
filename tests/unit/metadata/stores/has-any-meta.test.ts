import { describe, expect, test } from "bun:test";

import { mintUniqueKey } from "../../../../src/metadata/cardinality";
import { appendClassMeta, appendMemberMeta, hasAnyMeta } from "../../../../src/metadata/store";

describe("hasAnyMeta", () => {
	test("false when neither store has data for the chain", () => {
		class A {}
		class B extends A {}
		expect(hasAnyMeta(B)).toBe(false);
	});

	test("true when only class metadata exists on the ctor", () => {
		const key = mintUniqueKey("k");
		class A {}
		appendClassMeta(A, key, "v");
		expect(hasAnyMeta(A)).toBe(true);
	});

	test("true when only member metadata exists on the ctor", () => {
		const key = mintUniqueKey("k");
		class A {}
		appendMemberMeta(A, key, "foo", "v", Symbol("t"), { static: false, kind: "method" });
		expect(hasAnyMeta(A)).toBe(true);
	});

	test("walks ancestors and finds class metadata on a parent", () => {
		const key = mintUniqueKey("k");
		class A {}
		class B extends A {}
		appendClassMeta(A, key, "from-a");
		expect(hasAnyMeta(B)).toBe(true);
	});

	test("walks ancestors and finds member metadata on a parent", () => {
		const key = mintUniqueKey("k");
		class A {}
		class B extends A {}
		appendMemberMeta(A, key, "foo", "v", Symbol("t"), { static: false, kind: "method" });
		expect(hasAnyMeta(B)).toBe(true);
	});

	test("true when one link has class meta and another has member meta", () => {
		const classKey = mintUniqueKey("class");
		const memberKey = mintUniqueKey("member");
		class A {}
		class B extends A {}
		appendClassMeta(A, classKey, "v");
		appendMemberMeta(B, memberKey, "foo", "v", Symbol("t"), { static: false, kind: "method" });
		expect(hasAnyMeta(B)).toBe(true);
	});
});
