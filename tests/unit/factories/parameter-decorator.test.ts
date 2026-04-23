import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { createParameterDecorator } from "../../../src";

describe("createParameterDecorator", () => {
	test("should store simple metadata on constructor parameter", () => {
		const Inject = createParameterDecorator<string>();

		class Service {
			db: unknown;
			constructor(@Inject("db") db: unknown) {
				this.db = db;
			}
		}

		const params = Inject.reflect(Service).parameters();
		const param = params.find((p) => p.kind === "constructor-parameter" && p.parameterIndex === 0);
		expect(param?.metadata).toEqual(["db"]);
		const via = Inject.metadata(Service, 0);
		expect(via).toBe("db");
	});

	test("should store metadata on multiple parameters", () => {
		const Inject = createParameterDecorator<string>();

		class Service {
			db: unknown;
			logger: unknown;
			constructor(@Inject("db") db: unknown, @Inject("logger") logger: unknown) {
				this.db = db;
				this.logger = logger;
			}
		}

		const params = Inject.reflect(Service).parameters();
		expect(params.find((p) => p.kind === "constructor-parameter" && p.parameterIndex === 0)?.metadata).toEqual([
			"db",
		]);
		expect(params.find((p) => p.kind === "constructor-parameter" && p.parameterIndex === 1)?.metadata).toEqual([
			"logger",
		]);
	});

	test("should support compose function", () => {
		const Inject = createParameterDecorator({
			compose: (token: string, optional: boolean) => ({ token, optional }),
		});

		class Service {
			db: unknown;
			constructor(@Inject("db", false) db: unknown) {
				this.db = db;
			}
		}

		const param = Inject.reflect(Service)
			.parameters()
			.find((p) => p.kind === "constructor-parameter" && p.parameterIndex === 0);
		expect(param?.metadata).toEqual([{ token: "db", optional: false }]);
	});
});
