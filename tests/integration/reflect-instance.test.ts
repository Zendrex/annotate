import { describe, expect, test } from "bun:test";

import { reflect } from "../../src";
import { createClassDecorator } from "../../src/factories/class-decorator";
import { createMethodDecorator } from "../../src/factories/method-decorator";
import { createPropertyDecorator } from "../../src/factories/property-decorator";

describe("reflect(...) — Stage-3 fixtures", () => {
	test("reflect(instance) parity with reflect(Class)", () => {
		const Tag = createClassDecorator<string>();
		const Route = createMethodDecorator<string>();
		const Field = createPropertyDecorator<string>();

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
