import { describe, expect, test } from "bun:test";

import { UnregisteredClassError } from "../../src/errors";

const HINTS_PATTERN = /experimentalDecorators|reflect|materialize|import/;

describe("UnregisteredClassError", () => {
	test("carries the offending class on .target", () => {
		class NotDecorated {}
		const err = new UnregisteredClassError(NotDecorated);
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("UnregisteredClassError");
		expect(err.target).toBe(NotDecorated);
		expect(err.message).toContain("NotDecorated");
	});

	test("includes guidance hints in the message", () => {
		class X {}
		const err = new UnregisteredClassError(X);
		expect(err.message).toMatch(HINTS_PATTERN);
	});
});
