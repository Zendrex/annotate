import { describe, expect, test } from "bun:test";

import { getKeyCardinality, mintListKey, mintUniqueKey } from "../../../src/metadata/cardinality-registry";

describe("mintUniqueKey", () => {
	test("produces a symbol registered as 'unique'", () => {
		const key = mintUniqueKey<string>("test:unique");
		expect(typeof key).toBe("symbol");
		expect(getKeyCardinality(key)).toBe("unique");
	});

	test("description is forwarded to the underlying symbol", () => {
		const key = mintUniqueKey<number>("my-description");
		expect(key.description).toBe("my-description");
	});

	test("works without a description argument", () => {
		const key = mintUniqueKey<boolean>();
		expect(typeof key).toBe("symbol");
		expect(getKeyCardinality(key)).toBe("unique");
	});

	test("distinct calls produce distinct symbols with independent registrations", () => {
		const a = mintUniqueKey<string>("same");
		const b = mintUniqueKey<string>("same");
		expect(a).not.toBe(b);
		expect(getKeyCardinality(a)).toBe("unique");
		expect(getKeyCardinality(b)).toBe("unique");
	});
});

describe("mintListKey", () => {
	test("produces a symbol registered as 'list'", () => {
		const key = mintListKey<number>("test:list");
		expect(typeof key).toBe("symbol");
		expect(getKeyCardinality(key)).toBe("list");
	});

	test("description is forwarded to the underlying symbol", () => {
		const key = mintListKey<number>("list-desc");
		expect(key.description).toBe("list-desc");
	});

	test("works without a description argument", () => {
		const key = mintListKey<unknown>();
		expect(typeof key).toBe("symbol");
		expect(getKeyCardinality(key)).toBe("list");
	});

	test("distinct calls produce distinct symbols with independent cardinalities", () => {
		const a = mintListKey<string>("dup");
		const b = mintListKey<string>("dup");
		expect(a).not.toBe(b);
		expect(getKeyCardinality(a)).toBe("list");
		expect(getKeyCardinality(b)).toBe("list");
	});
});

describe("getKeyCardinality", () => {
	test("returns undefined for a bare Symbol not registered through mint helpers", () => {
		const bare = Symbol("x");
		expect(getKeyCardinality(bare)).toBeUndefined();
	});
});
