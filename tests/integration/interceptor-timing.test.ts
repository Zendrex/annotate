import { describe, expect, test } from "bun:test";

import { createMethodDecorator } from "../../src/factories/method-decorator";
import { createMethodInterceptor } from "../../src/factories/method-interceptor";

describe("interceptor decoration-order independence", () => {
	test("interceptor at the bottom observes sibling decorators applied above", () => {
		const Sibling = createMethodDecorator<string>();
		const seen: string[][] = [];
		const Bottom = createMethodInterceptor<string>({
			intercept: (original, readMetadata) =>
				function (this: unknown, ...args: unknown[]) {
					seen.push(readMetadata(this as object));
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
		expect(seen).toEqual([["from-bottom"]]);
		expect(Sibling.first(X, "run")).toBe("from-sibling");
	});
});
