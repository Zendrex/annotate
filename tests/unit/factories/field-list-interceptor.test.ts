import { describe, expect, test } from "bun:test";

import { intercept } from "../../../src";

describe("intercept.field.list", () => {
	test("replaces field value and records metadata", () => {
		const Stamp = intercept.field.list<string, [string], string>({
			onInit(this: object, _initial, readMetadata) {
				return readMetadata(this).join("+");
			},
		});

		class Box {
			@Stamp("a")
			label = "";
		}

		const b = new Box();
		expect(b.label).toBe("a");
		expect(Stamp.first(Box, "label")).toBe("a");
	});

	test("two stacked .list field decorations append metadata; final onInit slot wins", () => {
		const Stamp = intercept.field.list<string, [string], string>({
			onInit(this: object, _initial, readMetadata) {
				return readMetadata(this).join(",");
			},
		});

		class Cfg {
			@Stamp("outer")
			@Stamp("inner")
			label = "";
		}

		const c = new Cfg();
		expect(c.label).toBe("inner,outer");
		expect(Stamp.all(Cfg, "label")).toEqual(["inner", "outer"]);
	});

	test("throws when onInit missing", () => {
		expect(() => intercept.field.list({} as never)).toThrow(TypeError);
	});
});
