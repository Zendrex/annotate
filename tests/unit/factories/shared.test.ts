/** biome-ignore-all lint/complexity/noVoid: discard class references to avoid unused-variable warnings in test */
import { describe, expect, test } from "bun:test";

import { decorate, UnregisteredClassError } from "../../../src";

describe("decorate.class — all() shape", () => {
	test("all() is one-element and frozen; reader class metadata is scalar; bare ctor throws on all()", () => {
		const Tag = decorate.class<string>();
		const Other = decorate.class<string>();

		@Tag("a")
		class T1 {}
		expect(Tag.all(T1)).toEqual(["a"]);
		expect(Object.isFrozen(Tag.all(T1))).toBe(true);
		expect(Tag.reader(T1).class()?.metadata).toBe("a");

		@Other("x")
		class T2 {}
		expect(Tag.all(T2)).toEqual([]);

		class Bare {}
		expect(() => Tag.all(Bare)).toThrow(UnregisteredClassError);
	});
});
