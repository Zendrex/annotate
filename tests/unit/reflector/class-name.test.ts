import { describe, expect, test } from "bun:test";

import { formatSlot } from "../../../src/reflector/class-name";

describe("formatSlot", () => {
	test("returns the class display name when memberName is undefined", () => {
		class Subject {}
		expect(formatSlot(Subject)).toBe("Subject");
	});

	test("appends the member name with a dot separator", () => {
		class Subject {}
		expect(formatSlot(Subject, "field")).toBe("Subject.field");
	});

	test("stringifies symbol member names", () => {
		class Subject {}
		const sym = Symbol("tag");
		expect(formatSlot(Subject, sym)).toBe(`Subject.${String(sym)}`);
	});

	test("falls back to '<anonymous>' for an unnamed class", () => {
		const Anon = (() => class {})();
		Object.defineProperty(Anon, "name", { value: "" });
		expect(formatSlot(Anon)).toBe("<anonymous>");
	});
});
