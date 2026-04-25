/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
import { describe, expect, test } from "bun:test";

import { decorate } from "../../../src";
import { ClassTag, PropertyColumn } from "../../fixtures/decorators";

describe("factory.reader()", () => {
	test("should be scoped to key", () => {
		@ClassTag("scoped")
		class Target {}

		const scoped = ClassTag.reader(Target);
		const one = scoped.class();

		expect(one?.metadata).toEqual(["scoped"]);
	});

	test("should provide methods() and all() without key argument", () => {
		const Route = decorate.method<string>();

		class Target {
			@Route("/a")
			methodA() {}

			@Route("/b")
			methodB() {}
		}

		const scoped = Route.reader(Target);
		const methods = scoped.methods();
		expect(methods).toHaveLength(2);
		expect(scoped.all().length).toBeGreaterThanOrEqual(2);
	});

	test("should provide properties() without key argument", () => {
		class Target {
			@PropertyColumn("text")
			field!: string;
		}

		const scoped = PropertyColumn.reader(Target);
		const results = scoped.properties();

		expect(results).toHaveLength(1);
		expect(results[0]?.name).toBe("field");
	});
});

describe("ScopedReflector scalar accessors", () => {
	test("methodsScalar unwraps first metadata value", () => {
		const Route = decorate.method<string>();

		class Api {
			@Route("/users")
			list() {
				return null;
			}
		}

		const entry = Route.reader(Api)
			.methodsScalar()
			.find((item) => item.name === "list");
		expect(entry?.metadata).toBe("/users");
	});

	test("propertiesScalar unwraps first metadata value", () => {
		const Column = decorate.property<string>();

		class User {
			@Column("varchar")
			name!: string;
		}

		const entry = Column.reader(User)
			.propertiesScalar()
			.find((item) => item.name === "name");
		expect(entry?.metadata).toBe("varchar");
	});
});
