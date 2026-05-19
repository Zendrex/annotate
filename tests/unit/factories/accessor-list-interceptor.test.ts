/** biome-ignore-all lint/complexity/noVoid: type-only variable bindings discarded to prevent unused-variable errors */
/** biome-ignore-all lint/suspicious/noUnusedExpressions: accessor reads are the side effect under test */
import { describe, expect, test } from "bun:test";

import { intercept } from "../../../src/legacy";

describe("intercept.accessor.list", () => {
	test("wraps accessor getter and records metadata", () => {
		const Trace = intercept.accessor.list<string, [string], string>({
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
	});

	test("two stacked .list accessor decorations: onSet wrappers run for both", () => {
		const observed: string[] = [];

		const Watch = intercept.accessor.list<string, [string], string>({
			onSet: (original, readMetadata) =>
				function (this: unknown, v: string) {
					const meta = readMetadata(this as object);
					observed.push(`set:${v}:${meta.join(",")}`);
					original.call(this, v);
				},
		});

		class Cfg {
			@Watch("outer")
			@Watch("inner")
			accessor env = "dev";
		}

		const c = new Cfg();
		c.env = "prod";

		expect(observed).toHaveLength(2);
	});
});
