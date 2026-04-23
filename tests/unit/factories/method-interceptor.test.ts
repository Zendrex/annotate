import { describe, expect, test } from "bun:test";

// Temporary: importing directly until Phase M1 consolidates all factory exports into src/index.ts.
import { createMethodInterceptor } from "../../../src/factories/method-interceptor";

describe("createMethodInterceptor (Stage-3)", () => {
	test("wraps a method and records metadata", () => {
		const calls: string[] = [];
		const Log = createMethodInterceptor<string>({
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
		expect(Log.metadata(Svc, "run")).toBe("a");
	});

	test("readMetadata returns the complete ancestor-merged array at call-time", () => {
		const Outer = createMethodInterceptor<string>({
			intercept: (original, readMetadata) =>
				function (this: unknown, ...args: unknown[]) {
					(this as { _seen?: string[] })._seen = readMetadata(this as object);
					return original.call(this, ...args);
				} as typeof original,
		});

		class Parent {
			@Outer("p")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			run(): void {}
		}
		class Child extends Parent {
			// inherits run; ancestor merge should include "p"
		}

		const c = new Child() as Child & { _seen?: string[] };
		c.run();
		expect(c._seen).toEqual(["p"]);
	});

	test("static method interception", () => {
		const Cmd = createMethodInterceptor<string>({
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
		expect(Cmd.metadata(Cli, "greet")).toBe("build");
	});

	test("stacked interceptors: outer wraps inner; both metadata visible", () => {
		const Trace = createMethodInterceptor<string>({
			intercept: (original, readMetadata) =>
				function (this: unknown, ...args: unknown[]) {
					const meta = readMetadata(this as object);
					(this as { _all?: string[] })._all = meta;
					return original.call(this, ...args);
				} as typeof original,
		});

		class X {
			@Trace("outer")
			@Trace("inner")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			run(): void {}
		}

		const x = new X() as X & { _all?: string[] };
		x.run();
		expect(x._all).toEqual(["inner", "outer"]);
	});
});
