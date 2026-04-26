/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test stub methods */
/** biome-ignore-all lint/complexity/noVoid: type-only variable bindings discarded to prevent unused-variable errors */
import { describe, expect, test } from "bun:test";

import { intercept } from "../../../src";

describe("intercept.method.list", () => {
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

		expect(callOrder).toHaveLength(2);
		expect(callOrder[0]).toContain("outer");
		expect(callOrder[1]).toContain("inner");
		expect(result).toBe("raw");
	});

	test("two stacked .list interceptors: readMetadata returns BOTH entries inside each wrapper", () => {
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

		class Svc {
			@Outer("outer-meta")
			@Inner("inner-meta")
			run(): void {}
		}

		new Svc().run();

		expect(metaSeenByOuter).toEqual(["outer-meta"]);
		expect(metaSeenByInner).toEqual(["inner-meta"]);
	});

	test("two stacked .list decorations of the SAME factory: readMetadata returns both entries", () => {
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

		expect(metaSeen).toHaveLength(2);
		for (const seen of metaSeen) {
			expect(seen).toEqual(["inner", "outer"]);
		}
	});

	test("firstOrThrow() returns the first-stored value on a decorated member", () => {
		const Log = intercept.method.list<string>({
			intercept: (original) => original,
		});

		class Svc {
			@Log("outer")
			@Log("inner")
			run(): void {}
		}

		new Svc();
		expect(Log.firstOrThrow(Svc, "run")).toBe("inner");
	});

	test("static method list interception — both wrappers fire, each sees full list", () => {
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

		expect(metaPerWrapper).toHaveLength(2);
		for (const seen of metaPerWrapper) {
			expect(seen).toEqual(["inner", "outer"]);
		}
	});
});
