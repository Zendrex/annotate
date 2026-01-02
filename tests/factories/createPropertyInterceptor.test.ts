import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { createPropertyInterceptor } from "../../src/lib/factories";

describe("createPropertyInterceptor", () => {
	test("should intercept property set", () => {
		const setLog: string[] = [];

		const Track = createPropertyInterceptor<string>({
			onSet: (original, _meta, ctx) =>
				function (this: unknown, value: unknown) {
					setLog.push(`set:${String(ctx.propertyKey)}=${value}`);
					original.call(this, value);
				},
		});

		class Store {
			@Track("tracked")
			value = "";
		}

		const store = new Store();
		store.value = "hello";

		// First set is from initial value "", second is from explicit assignment
		expect(setLog).toEqual(["set:value=", "set:value=hello"]);
		expect(store.value).toBe("hello");
	});

	test("should intercept property get", () => {
		const getLog: string[] = [];

		const Monitor = createPropertyInterceptor<string>({
			onGet: (original, _meta, ctx) =>
				function (this: unknown) {
					getLog.push(`get:${String(ctx.propertyKey)}`);
					return original.call(this);
				},
		});

		class Store {
			@Monitor("monitored")
			value = "test";
		}

		const store = new Store();
		store.value = "initial";
		const _ = store.value;

		expect(getLog).toEqual(["get:value"]);
	});

	test("should support compose function", () => {
		let capturedMeta: Array<{ name: string; log: boolean }> = [];

		const Observable = createPropertyInterceptor({
			compose: (name: string, log: boolean) => ({ name, log }),
			onSet: (original, meta) => {
				capturedMeta = meta;
				return original;
			},
		});

		class Store {
			@Observable("counter", true)
			count = 0;
		}

		const store = new Store();
		store.count = 1;

		expect(capturedMeta).toEqual([{ name: "counter", log: true }]);
	});

	test("should store metadata for reflection", () => {
		const Observe = createPropertyInterceptor<string>({
			onSet: (original) => original,
		});

		class Store {
			@Observe("watched")
			prop = "";
		}

		const properties = Observe.properties(Store);
		const prop = properties.find((p) => p.name === "prop");
		expect(prop?.metadata).toEqual(["watched"]);
	});
});
