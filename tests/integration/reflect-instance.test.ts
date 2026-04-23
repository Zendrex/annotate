import { describe, expect, test } from "bun:test";

import {
	createClassDecorator,
	createMethodDecorator,
	createPropertyDecorator,
	reflect,
	UnregisteredClassError,
} from "../../src";

describe("reflect(...) — Stage-3 fixtures", () => {
	test("class-decorated fixture: eager registration", () => {
		const Tag = createClassDecorator<string>();
		const Field = createPropertyDecorator<string>();

		@Tag("svc")
		class Service {
			@Field("varchar")
			name!: string;
		}

		// No new Service() — class decorator drained pending Deferreds.
		const r = reflect(Service);
		expect(r.class<string>(Tag.key)?.metadata).toEqual(["svc"]);
		expect(r.properties<string>(Field.key).map((p) => p.name)).toEqual(["name"]);
	});

	test("static-member-only fixture: eager registration", () => {
		const Cmd = createMethodDecorator<string>();

		// biome-ignore lint/complexity/noStaticOnlyClass: test fixture requires a class with a single static method
		class Cli {
			@Cmd("build")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			static build(): void {}
		}

		const methods = reflect(Cli).methods<string>(Cmd.key);
		expect(methods).toHaveLength(1);
		expect(methods[0]?.name).toBe("build");
		expect(methods[0]?.static).toBe(true);
	});

	test("instance-member-only fixture: auto-materialize on reflect", () => {
		const Field = createPropertyDecorator<string>();

		class User {
			@Field("varchar")
			name!: string;
		}

		// No new User(); reflect must auto-materialize.
		const props = reflect(User).properties<string>(Field.key);
		expect(props.map((p) => p.name)).toEqual(["name"]);
	});

	test("never-decorated class throws UnregisteredClassError", () => {
		class Bare {}
		expect(() => reflect(Bare).methods(Symbol("x"))).toThrow(UnregisteredClassError);
	});

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
