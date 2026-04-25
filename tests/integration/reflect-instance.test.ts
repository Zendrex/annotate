import { describe, expect, test } from "bun:test";

import { decorate, reflect } from "../../src";

describe("reflect(...) — Stage-3 fixtures", () => {
	test("reflect(instance) parity with reflect(Class)", () => {
		const Tag = decorate.class<string>();
		const Route = decorate.method<string>();
		const Field = decorate.property<string>();

		@Tag("svc")
		class Service {
			@Field("varchar")
			name!: string;
			@Route("/ping")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			ping(): void {}
		}

		const instance = new Service();
		expect(reflect(instance).class<string>(Tag.key)).toEqual(reflect(Service).class<string>(Tag.key));
		expect(reflect(instance).methods<string>(Route.key)).toEqual(reflect(Service).methods<string>(Route.key));
		expect(reflect(instance).properties<string>(Field.key)).toEqual(reflect(Service).properties<string>(Field.key));
	});
});
