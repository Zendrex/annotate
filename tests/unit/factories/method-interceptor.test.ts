import { describe, expect, test } from "bun:test";

import { createMethodInterceptor } from "../../../src/factories/method-interceptor";

describe("createMethodInterceptor", () => {
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
		expect(Log.first(Svc, "run")).toBe("a");
		expect(
			Log.reader(Svc)
				.methods()
				.find((m) => m.name === "run")?.metadata
		).toBe("a");
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
		expect(Cmd.first(Cli, "greet")).toBe("build");
	});

	test("stacked interceptors via derive(): outer wraps inner; both entries visible via parent reader", () => {
		const Trace = createMethodInterceptor<string>({
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
