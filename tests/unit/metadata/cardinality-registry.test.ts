import { describe, expect, test } from "bun:test";

import {
	getKeyCardinality,
	mintListKey,
	mintMetadataKey,
	mintUniqueKey,
} from "../../../src/metadata/cardinality-registry";
import type { ListMetadataKey, UniqueMetadataKey } from "../../../src/metadata/types";

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

describe("mintMetadataKey", () => {
	test("with cardinality 'unique' produces a UniqueMetadataKey registered as 'unique'", () => {
		const key = mintMetadataKey<string>("unique", "test:mint:unique");
		expect(typeof key).toBe("symbol");
		expect(key.description).toBe("test:mint:unique");
		expect(getKeyCardinality(key)).toBe("unique");

		// Type-level: assignable to UniqueMetadataKey<T> without cast.
		const typed: UniqueMetadataKey<string> = key;
		expect(typed).toBe(key);
	});

	test("with cardinality 'list' produces a ListMetadataKey registered as 'list'", () => {
		const key = mintMetadataKey<number>("list", "test:mint:list");
		expect(typeof key).toBe("symbol");
		expect(key.description).toBe("test:mint:list");
		expect(getKeyCardinality(key)).toBe("list");

		// Type-level: assignable to ListMetadataKey<T> without cast.
		const typed: ListMetadataKey<number> = key;
		expect(typed).toBe(key);
	});

	test("works without a description argument", () => {
		const unique = mintMetadataKey<unknown>("unique");
		const list = mintMetadataKey<unknown>("list");
		expect(unique.description).toBeUndefined();
		expect(list.description).toBeUndefined();
		expect(getKeyCardinality(unique)).toBe("unique");
		expect(getKeyCardinality(list)).toBe("list");
	});

	test("distinct calls produce distinct symbols", () => {
		const a = mintMetadataKey<string>("unique", "shared");
		const b = mintMetadataKey<string>("unique", "shared");
		const c = mintMetadataKey<string>("list", "shared");
		expect(a).not.toBe(b);
		expect(a).not.toBe(c);
		expect(b).not.toBe(c);
	});

	test("overload narrowing: literal argument drives return type without second generic", () => {
		// Verify the overloads narrow correctly — no cast needed.
		const uniqueKey: UniqueMetadataKey<string> = mintMetadataKey<string>("unique");
		const listKey: ListMetadataKey<string> = mintMetadataKey<string>("list");
		expect(getKeyCardinality(uniqueKey)).toBe("unique");
		expect(getKeyCardinality(listKey)).toBe("list");
	});
});
