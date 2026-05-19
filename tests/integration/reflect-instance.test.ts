import { describe, expect, test } from "bun:test";

import { Annotate } from "../../src";

describe("reflect(...) — Stage-3 fixtures", () => {
	test("Annotate read(instance) parity with read(Class)", () => {
		const Tag = Annotate.class<string>();
		const Route = Annotate.method<string>();
		const Field = Annotate.field<string>();

		@Tag("svc")
		class Service {
			@Field("varchar")
			name!: string;
			@Route("/ping")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			ping(): void {}
		}

		const instance = new Service();
		expect(Tag.read(instance).entries()).toEqual(Tag.read(Service).entries());
		expect(Route.read(instance).methods()).toEqual(Route.read(Service).methods());
		expect(Field.read(instance).fields()).toEqual(Field.read(Service).fields());
	});
});
