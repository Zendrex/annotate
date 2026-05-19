/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test fixture methods */

import { describe, expect, test } from "bun:test";

import { Annotate } from "../../src";

describe("Annotate interceptors", () => {
	test("accessor interceptors wrap get and set hooks", () => {
		const events: unknown[] = [];
		const Watch = Annotate.intercept.accessor<string, [string], string>({
			args: (label) => label,
			get: (original, ctx) =>
				function (this: object) {
					events.push(["get", ctx.get(this)]);
					return original.call(this);
				},
			set: (original, ctx) =>
				function (this: object, value: string) {
					events.push(["set", ctx.get(this), value]);
					return original.call(this, value);
				},
		});

		class Box {
			@Watch("value")
			accessor value = "a";
		}

		const box = new Box();
		box.value = "b";
		expect(box.value).toBe("b");
		expect(events).toEqual([
			["set", "value", "b"],
			["get", "value"],
		]);
	});

	test("field interceptors replace instance and static field values", () => {
		const Default = Annotate.intercept.field<string, [string], string>({
			args: (label) => label,
			init(this: object, initial, ctx) {
				return `${initial}:${ctx.get(this) ?? "missing"}`;
			},
		});

		class Box {
			@Default("instance")
			label = "box";

			@Default("static")
			static mode = "mode";
		}

		expect(new Box().label).toBe("box:instance");
		expect(Box.mode).toBe("mode:static");
	});
});
