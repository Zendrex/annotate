/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { createMethodDecorator, createPropertyDecorator } from "../../../src";
import { ClassTag, ParamInject, PropertyColumn } from "../../fixtures/decorators";

describe("factory.reflect()", () => {
	test("should be scoped to key", () => {
		@ClassTag("scoped")
		class Target {}

		const scoped = ClassTag.reflect(Target);
		const one = scoped.class();

		expect(one?.metadata).toEqual(["scoped"]);
	});

	test("should provide methods() and all() without key argument", () => {
		const Route = createMethodDecorator<string>();

		class Target {
			@Route("/a")
			methodA() {}

			@Route("/b")
			methodB() {}
		}

		const scoped = Route.reflect(Target);
		const methods = scoped.methods();
		expect(methods).toHaveLength(2);
		expect(scoped.all().length).toBeGreaterThanOrEqual(2);
	});

	test("should provide properties() without key argument", () => {
		class Target {
			@PropertyColumn("text")
			field!: string;
		}

		const scoped = PropertyColumn.reflect(Target);
		const results = scoped.properties();

		expect(results).toHaveLength(1);
		expect(results[0]?.name).toBe("field");
	});

	test("should provide parameters() without key argument", () => {
		class Target {
			constructor(@ParamInject("token") _token: unknown) {}
		}

		const scoped = ParamInject.reflect(Target);
		const results = scoped.parameters();

		expect(results).toHaveLength(1);
		expect(results[0]?.kind).toBe("constructor-parameter");
	});
});

describe("ScopedReflector singular accessors", () => {
	test("methodsSingular unwraps first metadata value", () => {
		const Route = createMethodDecorator<string>();

		class Api {
			@Route("/users")
			list() {
				return null;
			}
		}

		const entry = Route.reflect(Api)
			.methodsSingular()
			.find((item) => item.name === "list");
		expect(entry?.metadata).toBe("/users");
	});

	test("propertiesSingular unwraps first metadata value", () => {
		const Column = createPropertyDecorator<string>();

		class User {
			@Column("varchar")
			name!: string;
		}

		const entry = Column.reflect(User)
			.propertiesSingular()
			.find((item) => item.name === "name");
		expect(entry?.metadata).toBe("varchar");
	});
});
