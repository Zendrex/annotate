import { describe, expect, test } from "bun:test";

import { Annotate } from "../../src";

describe("interceptor decoration-order independence", () => {
	test("interceptor at the bottom observes sibling decorators applied above", () => {
		const Sibling = Annotate.method<string>();
		const seen: (string | undefined)[] = [];
		const Bottom = Annotate.intercept.method<string>({
			wrap: (original, ctx) =>
				function (this: object, ...args: unknown[]) {
					seen.push(ctx.get(this));
					return original.call(this, ...args);
				} as typeof original,
		});

		class X {
			@Sibling("from-sibling")
			@Bottom("from-bottom")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test fixture
			run(): void {}
		}

		const x = new X();
		x.run();
		expect(seen).toEqual(["from-bottom"]);
		expect(Sibling.read(X).get((target) => target.run)).toBe("from-sibling");
	});
});
