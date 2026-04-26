import { describe, expect, test } from "bun:test";

import { reflect, UnregisteredClassError } from "../../../src";

const REFLECT_PROTOTYPE_PATTERN = /^reflect\(target\):.*prototype/;
const OBJECT_MENTION = /Object/;
const CONSTRUCTOR_MENTION = /constructor/;

describe("reflect() target resolution", () => {
	test("rejects arrow functions with prototype message", () => {
		const arrow = (): void => {
			return;
		};
		let err: unknown;
		try {
			reflect(arrow as unknown as object);
		} catch (caught) {
			err = caught;
		}
		expect(err).toBeInstanceOf(TypeError);
		expect(String((err as Error).message)).toMatch(REFLECT_PROTOTYPE_PATTERN);
	});

	test("rejects Object constructor", () => {
		expect(() => reflect(Object as unknown as object)).toThrow(TypeError);
		expect(() => reflect(Object as unknown as object)).toThrow(OBJECT_MENTION);
	});

	test("rejects plain object that resolves to Object as constructor", () => {
		expect(() => reflect({})).toThrow(TypeError);
		expect(() => reflect({})).toThrow(OBJECT_MENTION);
	});

	test("rejects Object.create(null) (no constructor)", () => {
		expect(() => reflect(Object.create(null) as object)).toThrow(TypeError);
		expect(() => reflect(Object.create(null) as object)).toThrow(CONSTRUCTOR_MENTION);
	});

	test("reflect(Array) constructs but queries throw UnregisteredClassError (no annotate metadata)", () => {
		expect(() => reflect(Array as unknown as object)).not.toThrow();
		const r = reflect(Array as unknown as object);
		expect(() => r.class(Symbol("k") as any)).toThrow(UnregisteredClassError);
	});
});
