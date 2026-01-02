import "reflect-metadata";

import type { ParameterMetadataMap } from "../src/lib/types";

import { describe, expect, test } from "bun:test";

import {
	appendMetadata,
	defineMetadata,
	getMetadata,
	getMetadataArray,
	getOwnMetadata,
	getParameterMap,
	setParameterMap,
} from "../src/lib/metadata";

// Test metadata keys
const TEST_KEY = Symbol("test:key");
const ARRAY_KEY = Symbol("test:array");
const PARAM_KEY = Symbol("test:param");

describe("defineMetadata", () => {
	test("should define metadata on a class", () => {
		class Target {}
		defineMetadata(TEST_KEY, "class-value", Target);

		const result = Reflect.getMetadata(TEST_KEY, Target);
		expect(result).toBe("class-value");
	});

	test("should define metadata on a property", () => {
		class Target {
			myProperty = "";
		}
		defineMetadata(TEST_KEY, "property-value", Target.prototype, "myProperty");

		const result = Reflect.getMetadata(TEST_KEY, Target.prototype, "myProperty");
		expect(result).toBe("property-value");
	});

	test("should define metadata with symbol property key", () => {
		const symbolKey = Symbol("prop");
		class Target {}
		defineMetadata(TEST_KEY, "symbol-prop-value", Target.prototype, symbolKey);

		const result = Reflect.getMetadata(TEST_KEY, Target.prototype, symbolKey);
		expect(result).toBe("symbol-prop-value");
	});
});

describe("getMetadata", () => {
	test("should retrieve metadata from target", () => {
		class Target {}
		Reflect.defineMetadata(TEST_KEY, "value", Target);

		const result = getMetadata<string>(TEST_KEY, Target);
		expect(result).toBe("value");
	});

	test("should retrieve metadata from property", () => {
		class Target {}
		Reflect.defineMetadata(TEST_KEY, "prop-value", Target.prototype, "method");

		const result = getMetadata<string>(TEST_KEY, Target.prototype, "method");
		expect(result).toBe("prop-value");
	});

	test("should return undefined for missing metadata", () => {
		class Target {}

		const result = getMetadata<string>(TEST_KEY, Target);
		expect(result).toBeUndefined();
	});

	test("should walk prototype chain", () => {
		class Parent {}
		class Child extends Parent {}
		Reflect.defineMetadata(TEST_KEY, "parent-value", Parent);

		const result = getMetadata<string>(TEST_KEY, Child);
		expect(result).toBe("parent-value");
	});
});

describe("getOwnMetadata", () => {
	test("should retrieve own metadata from target", () => {
		class Target {}
		Reflect.defineMetadata(TEST_KEY, "own-value", Target);

		const result = getOwnMetadata<string>(TEST_KEY, Target);
		expect(result).toBe("own-value");
	});

	test("should retrieve own metadata from property", () => {
		class Target {}
		Reflect.defineMetadata(TEST_KEY, "own-prop-value", Target.prototype, "method");

		const result = getOwnMetadata<string>(TEST_KEY, Target.prototype, "method");
		expect(result).toBe("own-prop-value");
	});

	test("should NOT walk prototype chain", () => {
		class Parent {}
		class Child extends Parent {}
		Reflect.defineMetadata(TEST_KEY, "parent-only", Parent);

		const result = getOwnMetadata<string>(TEST_KEY, Child);
		expect(result).toBeUndefined();
	});

	test("should return own value even when parent has different value", () => {
		class Parent {}
		class Child extends Parent {}
		Reflect.defineMetadata(TEST_KEY, "parent-value", Parent);
		Reflect.defineMetadata(TEST_KEY, "child-value", Child);

		const parentResult = getOwnMetadata<string>(TEST_KEY, Parent);
		const childResult = getOwnMetadata<string>(TEST_KEY, Child);
		expect(parentResult).toBe("parent-value");
		expect(childResult).toBe("child-value");
	});
});

describe("getMetadataArray", () => {
	test("should return empty array when no metadata exists", () => {
		class Target {}

		const result = getMetadataArray<string>(ARRAY_KEY, Target);
		expect(result).toEqual([]);
	});

	test("should return existing metadata array", () => {
		class Target {}
		const existingArray = ["a", "b", "c"];
		Reflect.defineMetadata(ARRAY_KEY, existingArray, Target);

		const result = getMetadataArray<string>(ARRAY_KEY, Target);
		expect(result).toEqual(["a", "b", "c"]);
	});

	test("should work with property key", () => {
		class Target {}
		const existingArray = [1, 2, 3];
		Reflect.defineMetadata(ARRAY_KEY, existingArray, Target.prototype, "prop");

		const result = getMetadataArray<number>(ARRAY_KEY, Target.prototype, "prop");
		expect(result).toEqual([1, 2, 3]);
	});

	test("should return own metadata only (not prototype chain)", () => {
		class Parent {}
		class Child extends Parent {}
		Reflect.defineMetadata(ARRAY_KEY, ["parent-item"], Parent);

		const result = getMetadataArray<string>(ARRAY_KEY, Child);
		expect(result).toEqual([]);
	});
});

describe("appendMetadata", () => {
	test("should create new array and append when no existing metadata", () => {
		const key = Symbol("append:new");
		class Target {}

		appendMetadata(key, Target, "first");

		const result = Reflect.getOwnMetadata(key, Target);
		expect(result).toEqual(["first"]);
	});

	test("should append to existing array", () => {
		const key = Symbol("append:existing");
		class Target {}
		Reflect.defineMetadata(key, ["existing"], Target);

		appendMetadata(key, Target, "appended");

		const result = Reflect.getOwnMetadata(key, Target);
		expect(result).toEqual(["existing", "appended"]);
	});

	test("should append multiple values in sequence", () => {
		const key = Symbol("append:multi");
		class Target {}

		appendMetadata(key, Target, "first");
		appendMetadata(key, Target, "second");
		appendMetadata(key, Target, "third");

		const result = Reflect.getOwnMetadata(key, Target);
		expect(result).toEqual(["first", "second", "third"]);
	});

	test("should work with property key", () => {
		const key = Symbol("append:prop");
		class Target {}

		appendMetadata(key, Target.prototype, "value", "myMethod");

		const result = Reflect.getOwnMetadata(key, Target.prototype, "myMethod");
		expect(result).toEqual(["value"]);
	});

	test("should append complex objects", () => {
		const key = Symbol("append:objects");
		class Target {}

		appendMetadata(key, Target, { id: 1, name: "first" });
		appendMetadata(key, Target, { id: 2, name: "second" });

		const result = Reflect.getOwnMetadata(key, Target);
		expect(result).toEqual([
			{ id: 1, name: "first" },
			{ id: 2, name: "second" },
		]);
	});
});

describe("getParameterMap", () => {
	test("should return empty map when no metadata exists", () => {
		class Target {}

		const result = getParameterMap<string>(PARAM_KEY, Target);
		expect(result).toBeInstanceOf(Map);
		expect(result.size).toBe(0);
	});

	test("should return existing parameter map", () => {
		class Target {}
		const existingMap: ParameterMetadataMap<string> = new Map([
			[0, ["param0"]],
			[1, ["param1"]],
		]);
		Reflect.defineMetadata(PARAM_KEY, existingMap, Target);

		const result = getParameterMap<string>(PARAM_KEY, Target);
		expect(result).toBeInstanceOf(Map);
		expect(result.get(0)).toEqual(["param0"]);
		expect(result.get(1)).toEqual(["param1"]);
	});

	test("should work with method property key", () => {
		class Target {}
		const existingMap: ParameterMetadataMap<number> = new Map([[0, [42]]]);
		Reflect.defineMetadata(PARAM_KEY, existingMap, Target.prototype, "method");

		const result = getParameterMap<number>(PARAM_KEY, Target.prototype, "method");
		expect(result.get(0)).toEqual([42]);
	});
});

describe("setParameterMap", () => {
	test("should store parameter map on target", () => {
		class Target {}
		const paramMap: ParameterMetadataMap<string> = new Map([[0, ["value"]]]);

		setParameterMap(PARAM_KEY, Target, paramMap);

		const result = Reflect.getOwnMetadata(PARAM_KEY, Target);
		expect(result).toBeInstanceOf(Map);
		expect(result.get(0)).toEqual(["value"]);
	});

	test("should store parameter map on method", () => {
		class Target {}
		const paramMap: ParameterMetadataMap<string> = new Map([
			[0, ["first"]],
			[1, ["second"]],
		]);

		setParameterMap(PARAM_KEY, Target.prototype, paramMap, "myMethod");

		const result = Reflect.getOwnMetadata(PARAM_KEY, Target.prototype, "myMethod");
		expect(result.get(0)).toEqual(["first"]);
		expect(result.get(1)).toEqual(["second"]);
	});

	test("should overwrite existing parameter map", () => {
		class Target {}
		const oldMap: ParameterMetadataMap<string> = new Map([[0, ["old"]]]);
		const newMap: ParameterMetadataMap<string> = new Map([[0, ["new"]]]);

		setParameterMap(PARAM_KEY, Target, oldMap);
		setParameterMap(PARAM_KEY, Target, newMap);

		const result = Reflect.getOwnMetadata(PARAM_KEY, Target);
		expect(result.get(0)).toEqual(["new"]);
	});
});

describe("integration", () => {
	test("defineMetadata and getMetadata should work together", () => {
		const key = Symbol("integration:define-get");
		class Target {}

		defineMetadata(key, { complex: "value" }, Target);
		const result = getMetadata<{ complex: string }>(key, Target);

		expect(result).toEqual({ complex: "value" });
	});

	test("appendMetadata and getMetadataArray should work together", () => {
		const key = Symbol("integration:append-array");
		class Target {}

		appendMetadata(key, Target, "one");
		appendMetadata(key, Target, "two");
		const result = getMetadataArray<string>(key, Target);

		expect(result).toEqual(["one", "two"]);
	});

	test("setParameterMap and getParameterMap should work together", () => {
		const key = Symbol("integration:param-map");
		class Target {}
		const map: ParameterMetadataMap<string> = new Map([[0, ["param"]]]);

		setParameterMap(key, Target, map, "method");
		const result = getParameterMap<string>(key, Target, "method");

		expect(result.get(0)).toEqual(["param"]);
	});
});
