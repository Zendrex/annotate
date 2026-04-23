import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { createPropertyInterceptor } from "../../../src";

const CREATE_PROPERTY_INTERCEPTOR_PREFIX = /^createPropertyInterceptor:/;
const ON_GET = /onGet/;
const ON_SET = /onSet/;

describe("createPropertyInterceptor({})", () => {
	test("throws TypeError with stable prefix and onGet/onSet mention", () => {
		expect(() => createPropertyInterceptor({} as never)).toThrow(TypeError);
		expect(() => createPropertyInterceptor({} as never)).toThrow(CREATE_PROPERTY_INTERCEPTOR_PREFIX);
		expect(() => createPropertyInterceptor({} as never)).toThrow(ON_GET);
		expect(() => createPropertyInterceptor({} as never)).toThrow(ON_SET);
	});
});

describe("createPropertyInterceptor", () => {
	test("should intercept property set", () => {
		const setLog: string[] = [];

		const Track = createPropertyInterceptor<string>({
			onSet: (original, _meta, ctx) =>
				function (this: unknown, value: unknown) {
					setLog.push(`set:${String(ctx.name)}=${value}`);
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
					getLog.push(`get:${String(ctx.name)}`);
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
});
