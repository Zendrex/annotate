import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { createMethodInterceptor } from "../../../src";

describe("createMethodInterceptor", () => {
	test("should wrap method and intercept calls", () => {
		const calls: string[] = [];

		const Log = createMethodInterceptor<string>({
			intercept: (original, _meta, ctx) =>
				function (this: unknown, ...args: unknown[]) {
					calls.push(`before:${String(ctx.name)}`);
					const result = original.apply(this, args);
					calls.push(`after:${String(ctx.name)}`);
					return result;
				},
		});

		class Service {
			@Log("info")
			doWork() {
				calls.push("work");
				return "done";
			}
		}

		const service = new Service();
		const result = service.doWork();

		expect(result).toBe("done");
		expect(calls).toEqual(["before:doWork", "work", "after:doWork"]);
	});

	test("should provide metadata to interceptor", () => {
		let capturedMeta: string[] = [];

		const Track = createMethodInterceptor<string>({
			intercept: (original, meta) => {
				capturedMeta = meta;
				return original;
			},
		});

		class Service {
			@Track("tag1")
			@Track("tag2")
			method() {
				return null;
			}
		}

		new Service().method();

		expect(capturedMeta).toEqual(["tag2", "tag1"]);
	});

	test("should support compose function", () => {
		let capturedMeta: Array<{ level: string; enabled: boolean }> = [];

		const Trace = createMethodInterceptor({
			compose: (level: string, enabled: boolean) => ({ level, enabled }),
			intercept: (original, meta) => {
				capturedMeta = meta;
				return original;
			},
		});

		class Service {
			@Trace("debug", true)
			method() {
				return null;
			}
		}

		new Service().method();

		expect(capturedMeta).toEqual([{ level: "debug", enabled: true }]);
	});
});
