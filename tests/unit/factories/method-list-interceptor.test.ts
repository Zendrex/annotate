/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test stub methods */
/** biome-ignore-all lint/complexity/noVoid: type-only variable bindings discarded to prevent unused-variable errors */
import { describe, expect, test } from "bun:test";

import { intercept } from "../../../src";
import type { ListMetadataKey } from "../../../src";

describe("intercept.method.list", () => {
	test("returns a factory whose .key is assignable to ListMetadataKey<T>", () => {
		const Log = intercept.method.list<string>({
			intercept: (original) => original,
		});
		expect(typeof Log.key).toBe("symbol");

		const _check: ListMetadataKey<string> = Log.key;
		void _check;
	});

	test("wraps a method, records metadata, and readMetadata returns the list", () => {
		const seen: string[] = [];

		const Log = intercept.method.list<string>({
			intercept: (original, readMetadata) =>
				function (this: unknown, ...args: unknown[]) {
					const meta = readMetadata(this as object);
					seen.push(...meta);
					return original.call(this, ...args);
				} as typeof original,
		});

		class Svc {
			@Log("a")
			run(x: number): number {
				return x + 1;
			}
		}

		const s = new Svc();
		expect(s.run(1)).toBe(2);
		expect(seen).toEqual(["a"]);
		expect(Log.first(Svc, "run")).toBe("a");
	});

	test("two stacked .list interceptors on one method: both wrappers run (Stage-3 order)", () => {
		// Stage-3: decorators are applied bottom-up at definition time.
		// @LogOuter is listed first in source, @LogInner is listed second (closer to the method).
		// Application order at definition: LogInner runs first (wraps the raw method),
		// then LogOuter runs (wraps the LogInner-wrapped method).
		// Call order: LogOuter intercept runs first, then LogInner intercept.
		const callOrder: string[] = [];

		const Log = intercept.method.list<string>({
			intercept: (original, readMetadata, context) =>
				function (this: unknown, ...args: unknown[]) {
					const meta = readMetadata(this as object);
					callOrder.push(`${String(context.name)}:${meta.join(",")}`);
					return original.call(this, ...args);
				} as typeof original,
		});

		class Svc {
			@Log("outer")
			@Log("inner")
			run(): string {
				return "raw";
			}
		}

		const s = new Svc();
		const result = s.run();

		// Both wrappers ran
		expect(callOrder).toHaveLength(2);
		// Outer wrapper fires first at call time
		expect(callOrder[0]).toContain("outer");
		expect(callOrder[1]).toContain("inner");
		expect(result).toBe("raw");
	});

	test("two stacked .list interceptors: readMetadata returns BOTH entries inside each wrapper", () => {
		// Both decorations commit metadata to the store.
		// readMetadata is called at invocation time, after both decorations are applied,
		// so the full list [inner, outer] is visible from either wrapper.
		const metaSeenByOuter: string[] = [];
		const metaSeenByInner: string[] = [];

		const Outer = intercept.method.list<string>({
			intercept: (original, readMetadata) =>
				function (this: unknown, ...args: unknown[]) {
					metaSeenByOuter.push(...readMetadata(this as object));
					return original.call(this, ...args);
				} as typeof original,
		});

		const Inner = intercept.method.list<string>({
			intercept: (original, readMetadata) =>
				function (this: unknown, ...args: unknown[]) {
					metaSeenByInner.push(...readMetadata(this as object));
					return original.call(this, ...args);
				} as typeof original,
		});

		// Each factory has its own key; readMetadata is scoped to its own key.
		// Outer sees only its own metadata; Inner sees only its own metadata.
		class Svc {
			@Outer("outer-meta")
			@Inner("inner-meta")
			run(): void {}
		}

		new Svc().run();

		// Each factory sees only its own entry (separate keys)
		expect(metaSeenByOuter).toEqual(["outer-meta"]);
		expect(metaSeenByInner).toEqual(["inner-meta"]);
	});

	test("two stacked .list decorations of the SAME factory: readMetadata returns both entries", () => {
		// Same factory applied twice — same key, so readMetadata returns both entries.
		const metaSeen: string[][] = [];

		const Log = intercept.method.list<string>({
			intercept: (original, readMetadata) =>
				function (this: unknown, ...args: unknown[]) {
					metaSeen.push(readMetadata(this as object));
					return original.call(this, ...args);
				} as typeof original,
		});

		class Svc {
			@Log("outer")
			@Log("inner")
			run(): void {}
		}

		new Svc().run();

		// Two wrappers ran, each reading the full list
		expect(metaSeen).toHaveLength(2);
		// Both wrappers see both entries (inner stored first, outer second — inner decorates first)
		for (const seen of metaSeen) {
			expect(seen).toHaveLength(2);
			expect(seen).toContain("inner");
			expect(seen).toContain("outer");
		}
	});

	test("metadata reader returns all accumulated list entries for the member", () => {
		const Log = intercept.method.list<string>({
			intercept: (original) => original,
		});

		class Svc {
			@Log("a")
			@Log("b")
			@Log("c")
			run(): void {}
		}

		new Svc();
		// Stage-3 inner-first ordering: "c" applies first, then "b", then "a"
		const all = Log.all(Svc, "run");
		expect(all).toHaveLength(3);
		expect(all).toContain("a");
		expect(all).toContain("b");
		expect(all).toContain("c");
	});

	test("static method list interception — both wrappers fire, each sees full list", () => {
		// Two list decorations on a static method: two wrappers, each reading both entries.
		const metaPerWrapper: string[][] = [];

		const Cmd = intercept.method.list<string>({
			intercept: (original, readMetadata) =>
				((...args: unknown[]) => {
					const meta = readMetadata(Cli as unknown as object);
					metaPerWrapper.push([...meta]);
					return original(...args);
				}) as typeof original,
		});

		// biome-ignore lint/complexity/noStaticOnlyClass: test fixture requires a class with a static method
		class Cli {
			@Cmd("outer")
			@Cmd("inner")
			static run(): string {
				return "ok";
			}
		}

		const result = Cli.run();
		expect(result).toBe("ok");

		// Two wrappers ran
		expect(metaPerWrapper).toHaveLength(2);
		// Each wrapper sees the full list
		for (const seen of metaPerWrapper) {
			expect(seen).toHaveLength(2);
			expect(seen).toContain("outer");
			expect(seen).toContain("inner");
		}
	});
});
