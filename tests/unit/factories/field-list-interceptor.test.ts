import { describe, expect, test } from "bun:test";

import { createFieldListInterceptor } from "../../../src/factories/field-interceptor";

describe("createFieldListInterceptor", () => {
	test("replaces field value and records metadata", () => {
		const Stamp = createFieldListInterceptor<string, [string], string>({
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
		const Stamp = createFieldListInterceptor<string, [string], string>({
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
		expect(() => createFieldListInterceptor({} as never)).toThrow(TypeError);
	});
});
