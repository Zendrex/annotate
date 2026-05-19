import { describe, expect, test } from "bun:test";

import { intercept } from "../../../src/legacy";

describe("intercept.accessor", () => {
	test("intercepts accessor getter and records metadata", () => {
		const Trace = intercept.accessor<string, [string], string>({
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
		expect(Trace.first(Box, "value")).toBe("a");
		expect(
			Trace.reader(Box)
				.properties()
				.find((p) => p.name === "value")?.metadata
		).toBe("a");
	});

	test("intercepts setter side", () => {
		const observed: string[] = [];
		const Watch = intercept.accessor<string, [string], string>({
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
		expect(() => intercept.accessor({} as never)).toThrow(TypeError);
	});

	test("ancestor-merged metadata visible in onGet at call-time", () => {
		const Layer = intercept.accessor<string, [string], number>({
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

	// Regression (plan EA-6): accessor-decorated members must reflect into
	// .properties(), not .methods(), because auto-accessor get/set pairs
	// previously fooled the descriptor-based classifier.
	test("accessor appears in reflect().properties(), not .methods()", () => {
		const Tag = intercept.accessor<string, [string], number>({
			onGet: (original) =>
				function (this: unknown) {
					return original.call(this);
				},
		});

		class Box {
			@Tag("v")
			accessor x = 0;
		}

		new Box();
		const props = Tag.reader(Box).properties();
		const methods = Tag.reader(Box).methods();
		expect(props).toHaveLength(1);
		expect(methods).toHaveLength(0);
		expect(props[0]?.name).toBe("x");
		expect(props[0]?.static).toBe(false);
	});
});
