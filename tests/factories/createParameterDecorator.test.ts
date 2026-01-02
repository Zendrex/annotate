import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { createParameterDecorator } from "../../src/lib/factories";

describe("createParameterDecorator", () => {
	test("should store simple metadata on constructor parameter", () => {
		const Inject = createParameterDecorator<string>();

		class Service {
			db: unknown;
			constructor(@Inject("db") db: unknown) {
				this.db = db;
			}
		}

		const params = Inject.parameters(Service);
		const param = params.find((p) => p.name === "constructor" && p.parameterIndex === 0);
		expect(param?.metadata).toEqual(["db"]);
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

		const params = Inject.parameters(Service);
		expect(params.find((p) => p.parameterIndex === 0)?.metadata).toEqual(["db"]);
		expect(params.find((p) => p.parameterIndex === 1)?.metadata).toEqual(["logger"]);
	});

	test("should support compose function", () => {
		const Inject = createParameterDecorator((token: string, optional: boolean) => ({ token, optional }));

		class Service {
			db: unknown;
			constructor(@Inject("db", false) db: unknown) {
				this.db = db;
			}
		}

		const params = Inject.parameters(Service);
		const param = params.find((p) => p.parameterIndex === 0);
		expect(param?.metadata).toEqual([{ token: "db", optional: false }]);
	});

	test("should provide scoped reflector via reflect()", () => {
		const Meta = createParameterDecorator<string>();

		class Target {
			param: unknown;
			constructor(@Meta("test") param: unknown) {
				this.param = param;
			}
		}

		const reflector = Meta.reflect(Target);
		const param = reflector.parameters().find((p) => p.parameterIndex === 0);
		expect(param?.metadata).toEqual(["test"]);
	});
});
