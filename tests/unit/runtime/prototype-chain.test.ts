import { describe, expect, test } from "bun:test";

import { walkPrototypeChain } from "../../../src/runtime/prototype-chain";

describe("walkPrototypeChain", () => {
	test("visits ctor then each ancestor up to (but excluding) Function.prototype", () => {
		class Base {}
		class Mid extends Base {}
		class Leaf extends Mid {}

		const visited: unknown[] = [];
		walkPrototypeChain(Leaf, (current) => {
			visited.push(current);
		});

		expect(visited).toEqual([Leaf, Mid, Base]);
	});

	test("stops when visit returns true", () => {
		class Base {}
		class Mid extends Base {}
		class Leaf extends Mid {}

		const visited: unknown[] = [];
		walkPrototypeChain(Leaf, (current) => {
			visited.push(current);
			return current === Mid;
		});

		expect(visited).toEqual([Leaf, Mid]);
	});

	test("visits only ctor when no ancestor class exists", () => {
		class Solo {}
		const visited: unknown[] = [];
		walkPrototypeChain(Solo, (current) => {
			visited.push(current);
		});
		expect(visited).toEqual([Solo]);
	});
});
