import { describe, expect, it } from "bun:test";

import { getOrCreate } from "../../../../src/metadata/stores/get-or-create";

describe("getOrCreate with Map", () => {
	it("returns existing value without calling factory", () => {
		const map = new Map([["key", "existing"]]);
		let factoryCalled = false;
		const result = getOrCreate(map, "key", () => {
			factoryCalled = true;
			return "new";
		});
		expect(result).toBe("existing");
		expect(factoryCalled).toBe(false);
	});

	it("calls factory and stores value when key is absent", () => {
		const map = new Map<string, string>();
		let factoryCallCount = 0;
		const result = getOrCreate(map, "key", () => {
			factoryCallCount += 1;
			return "created";
		});
		expect(result).toBe("created");
		expect(factoryCallCount).toBe(1);
		expect(map.get("key")).toBe("created");
	});

	it("calls factory only once on repeated calls with same key", () => {
		const map = new Map<string, string>();
		let factoryCallCount = 0;
		const factory = () => {
			factoryCallCount += 1;
			return `value-${factoryCallCount}`;
		};

		const first = getOrCreate(map, "key", factory);
		const second = getOrCreate(map, "key", factory);

		expect(first).toBe("value-1");
		expect(second).toBe("value-1");
		expect(factoryCallCount).toBe(1);
	});

	it("distinguishes between different keys", () => {
		const map = new Map<string, string>();
		const factory = (key: string) => `value-${key}`;

		getOrCreate(map, "a", () => factory("a"));
		getOrCreate(map, "b", () => factory("b"));

		expect(map.get("a")).toBe("value-a");
		expect(map.get("b")).toBe("value-b");
	});
});

describe("getOrCreate with WeakMap", () => {
	it("returns existing value without calling factory", () => {
		const obj = {};
		const map = new WeakMap([[obj, "existing"]]);
		let factoryCalled = false;
		const result = getOrCreate(map, obj, () => {
			factoryCalled = true;
			return "new";
		});
		expect(result).toBe("existing");
		expect(factoryCalled).toBe(false);
	});

	it("calls factory and stores value when key is absent", () => {
		const obj = {};
		const map = new WeakMap<object, string>();
		let factoryCallCount = 0;
		const result = getOrCreate(map, obj, () => {
			factoryCallCount += 1;
			return "created";
		});
		expect(result).toBe("created");
		expect(factoryCallCount).toBe(1);
		expect(map.get(obj)).toBe("created");
	});

	it("calls factory only once on repeated calls with same key", () => {
		const obj = {};
		const map = new WeakMap<object, string>();
		let factoryCallCount = 0;
		const factory = () => {
			factoryCallCount += 1;
			return `value-${factoryCallCount}`;
		};

		const first = getOrCreate(map, obj, factory);
		const second = getOrCreate(map, obj, factory);

		expect(first).toBe("value-1");
		expect(second).toBe("value-1");
		expect(factoryCallCount).toBe(1);
	});

	it("works with constructors as keys", () => {
		class MyClass {}
		const map = new WeakMap<object, string>();
		const result = getOrCreate(map, MyClass, () => "MyClass-value");
		expect(result).toBe("MyClass-value");
		expect(map.get(MyClass)).toBe("MyClass-value");
	});
});
