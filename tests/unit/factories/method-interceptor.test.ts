import { describe, expect, test } from "bun:test";

import { intercept } from "../../../src";

describe("intercept.method", () => {
	test("wraps a method and records metadata", () => {
		const calls: string[] = [];
		const Log = intercept.method<string>({
			intercept: (original, readMetadata, context) =>
				function (this: unknown, ...args: unknown[]) {
					const meta = readMetadata(this as object);
					calls.push(`${context.name as string}:${meta.join(",")}`);
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
		expect(calls).toEqual(["run:a"]);
		expect(Log.first(Svc, "run")).toBe("a");
	});

	test("static method interception", () => {
		const Cmd = intercept.method<string>({
			intercept: (original) => ((...args: unknown[]) => `[${original(...args)}]`) as typeof original,
		});

		// biome-ignore lint/complexity/noStaticOnlyClass: test fixture requires a class with a single static method
		class Cli {
			@Cmd("build")
			static greet(): string {
				return "hi";
			}
		}
		expect(Cli.greet()).toBe("[hi]");
		expect(Cmd.first(Cli, "greet")).toBe("build");
	});

	/**
	 * Coverage note — stacked-interceptor wrapper composition:
	 *
	 * Applying two unique-cardinality interceptors (e.g. @Trace twice) to the
	 * same prototype slot now correctly throws `DuplicateMetadataError`.
	 *
	 * True stacked-wrapper composition — two wrappers running in sequence on one
	 * member — belongs to `intercept.method.list` (list-cardinality keys allow
	 * multiple entries per slot). That behaviour is covered in T3 per spec
	 * §Testing: "Unit — list interceptors: stacking two `intercept.method.list`
	 * decorators on one method wraps twice (Stage 3 order) and appends two
	 * entries".
	 *
	 * This test exercises *metadata visibility across an inheritance chain*
	 * only: `TraceInner` is applied to the overriding `X.run` slot while
	 * `Trace` is applied to the base `Base.run` slot. In Stage 3 semantics an
	 * override replaces the prototype slot, so both decorators target distinct
	 * slots, and the `Trace` reader on `x` correctly surfaces both entries via
	 * the shared key that `derive()` preserves.
	 */
	test("stacked interceptors via derive(): outer wraps inner; both entries visible via parent reader", () => {
		const Trace = intercept.method<string>({
			intercept: (original, readMetadata) =>
				function (this: unknown, ...args: unknown[]) {
					const meta = readMetadata(this as object);
					(this as { _all?: string[] })._all = meta;
					return original.call(this, ...args);
				} as typeof original,
		});
		// derive() shares the same key so both entries are visible via the Trace reader.
		const TraceInner = Trace.derive();

		class Base {
			@Trace("outer")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			run(): void {}
		}
		class X extends Base {
			@TraceInner("inner")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			override run(): void {}
		}

		const x = new X() as X & { _all?: string[] };
		x.run();
		expect(x._all).toEqual(["inner", "outer"]);
	});
});
