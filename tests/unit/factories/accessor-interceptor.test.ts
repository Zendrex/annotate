import { describe, expect, test } from "bun:test";

// Temporary: importing directly until Phase M1 consolidates all factory exports into src/index.ts.
import { createAccessorInterceptor } from "../../../src/factories/accessor-interceptor";

describe("createAccessorInterceptor (Stage-3)", () => {
	test("intercepts accessor getter and records metadata", () => {
		const Trace = createAccessorInterceptor<string, [string], string>({
			onGet: (original, readMetadata) =>
				function (this: unknown) {
					const meta = readMetadata(this as object);
					return `[${meta.join(",")}]:${original.call(this)}`;
				},
		});

		class Box {
			@Trace("a")
			accessor value = "v";
		}

		const b = new Box();
		expect(b.value).toBe("[a]:v");
		expect(Trace.metadata(Box, "value")).toBe("a");
	});

	test("intercepts setter side", () => {
		const observed: string[] = [];
		const Watch = createAccessorInterceptor<string, [string], string>({
			onSet: (original) =>
				function (this: unknown, v: string) {
					observed.push(v);
					original.call(this, v);
				},
		});

		class Cfg {
			@Watch("env")
			accessor env = "dev";
		}

		const c = new Cfg();
		c.env = "prod";
		expect(observed).toEqual(["prod"]);
	});

	test("throws when neither onGet nor onSet provided", () => {
		expect(() => createAccessorInterceptor({} as never)).toThrow(TypeError);
	});

	test("ancestor-merged metadata visible in onGet at call-time", () => {
		const Layer = createAccessorInterceptor<string, [string], number>({
			onGet: (original, readMetadata) =>
				function (this: unknown) {
					const meta = readMetadata(this as object);
					(this as { _seen?: string[] })._seen = meta;
					return original.call(this);
				},
		});

		class Parent {
			@Layer("p")
			accessor x = 1;
		}
		class Child extends Parent {}

		const c = new Child() as Child & { _seen?: string[] };
		const _read = c.x;
		expect(c._seen).toEqual(["p"]);
	});
});
