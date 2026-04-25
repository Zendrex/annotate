import { describe, expect, test } from "bun:test";

import { decorate, intercept } from "../../src";

describe("interceptor decoration-order independence", () => {
	test("interceptor at the bottom observes sibling decorators applied above", () => {
		const Sibling = decorate.method<string>();
		const seen: string[][] = [];
		const Bottom = intercept.method<string>({
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

	test("negative: snapshotting metadata at decoration time would yield empty array", () => {
		// Documents the failure mode the API design prevents. If a consumer wrote
		// `intercept: (original, readMetadata) => { const snap = readMetadata({} as never); ... }`
		// they would close over an empty array. The library does not expose a
		// decoration-time materialized array — only the reader. This test
		// confirms the reader at decoration time over a non-instance returns [].
		const state: { snapshot: string[] | null } = { snapshot: null };
		const Trace = intercept.method<string>({
			intercept: (original, readMetadata) => {
				// Misuse: call readMetadata with a synthetic object at decoration time.
				state.snapshot = readMetadata(Object.create(null));
				return original;
			},
		});
		class X {
			@Trace("v")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test fixture
			run(): void {}
		}
		// biome-ignore lint/complexity/noVoid: discard class reference to avoid unused-variable warning in test
		void X;
		expect(state.snapshot).toEqual([]);
	});
});
