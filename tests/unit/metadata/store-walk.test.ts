import { describe, expect, test } from "bun:test";

import { chainHasNonEmpty, collectFromChain, firstOnChain } from "../../../src/metadata/store-walk";

describe("store-walk helpers", () => {
	describe("chainHasNonEmpty", () => {
		test("returns true when subclass link matches", () => {
			class Super {}
			class Sub extends Super {}
			const matches = new WeakSet<object>([Sub]);
			expect(chainHasNonEmpty(Sub, (current) => matches.has(current))).toBe(true);
		});

		test("returns true when only a superclass link matches", () => {
			class Super {}
			class Sub extends Super {}
			const matches = new WeakSet<object>([Super]);
			expect(chainHasNonEmpty(Sub, (current) => matches.has(current))).toBe(true);
		});

		test("returns false when no link matches", () => {
			class Super {}
			class Sub extends Super {}
			expect(chainHasNonEmpty(Sub, () => false)).toBe(false);
		});

		test("short-circuits at the first matching link", () => {
			class Super {}
			class Sub extends Super {}
			const visited: unknown[] = [];
			chainHasNonEmpty(Sub, (current) => {
				visited.push(current);
				return current === Sub;
			});
			expect(visited).toEqual([Sub]);
		});
	});

	describe("firstOnChain", () => {
		test("prefers subclass value over superclass value", () => {
			class Super {}
			class Sub extends Super {}
			const data = new WeakMap<object, readonly string[]>([
				[Super, ["super-1"]],
				[Sub, ["sub-1", "sub-2"]],
			]);
			expect(firstOnChain<string>(Sub, (current) => data.get(current))).toBe("sub-1");
		});

		test("falls back to superclass when subclass list is missing", () => {
			class Super {}
			class Sub extends Super {}
			const data = new WeakMap<object, readonly string[]>([[Super, ["super-1"]]]);
			expect(firstOnChain<string>(Sub, (current) => data.get(current))).toBe("super-1");
		});

		test("skips empty lists and continues walking", () => {
			class Super {}
			class Sub extends Super {}
			const data = new WeakMap<object, readonly string[]>([
				[Sub, []],
				[Super, ["super-1"]],
			]);
			expect(firstOnChain<string>(Sub, (current) => data.get(current))).toBe("super-1");
		});

		test("returns undefined when no link has a non-empty list", () => {
			class Super {}
			class Sub extends Super {}
			expect(firstOnChain<string>(Sub, () => undefined)).toBeUndefined();
		});
	});

	describe("collectFromChain", () => {
		test("preserves walk order: subclass values before superclass values", () => {
			class Super {}
			class Sub extends Super {}
			const data = new WeakMap<object, readonly string[]>([
				[Sub, ["sub-1", "sub-2"]],
				[Super, ["super-1"]],
			]);
			expect(collectFromChain<string>(Sub, (current) => data.get(current))).toEqual([
				"sub-1",
				"sub-2",
				"super-1",
			]);
		});

		test("skips empty and missing links without inserting holes", () => {
			class Super {}
			class Mid extends Super {}
			class Sub extends Mid {}
			const data = new WeakMap<object, readonly string[]>([
				[Sub, []],
				[Super, ["super-1"]],
			]);
			expect(collectFromChain<string>(Sub, (current) => data.get(current))).toEqual(["super-1"]);
		});

		test("returns empty array when no link contributes values", () => {
			class Super {}
			class Sub extends Super {}
			expect(collectFromChain<string>(Sub, () => undefined)).toEqual([]);
		});
	});
});
