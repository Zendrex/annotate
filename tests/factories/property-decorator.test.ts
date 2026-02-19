import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { createPropertyDecorator } from "../../src/lib/factories";

describe("createPropertyDecorator", () => {
	test("should store simple metadata on property", () => {
		const Column = createPropertyDecorator<string>();

		class User {
			@Column("varchar")
			name!: string;
		}

		const columns = Column.properties(User);
		const column = columns.find((c) => c.name === "name");
		expect(column?.metadata).toEqual(["varchar"]);
	});

	test("should store metadata on multiple properties", () => {
		const Field = createPropertyDecorator<string>();

		class Entity {
			@Field("string")
			name!: string;

			@Field("number")
			age!: number;
		}

		const fields = Field.properties(Entity);
		expect(fields.find((f) => f.name === "name")?.metadata).toEqual(["string"]);
		expect(fields.find((f) => f.name === "age")?.metadata).toEqual(["number"]);
	});

	test("should support compose function", () => {
		const Column = createPropertyDecorator((type: string, nullable: boolean) => ({ type, nullable }));

		class User {
			@Column("varchar", false)
			name!: string;
		}

		const columns = Column.properties(User);
		const column = columns.find((c) => c.name === "name");
		expect(column?.metadata).toEqual([{ type: "varchar", nullable: false }]);
	});

	test("should provide scoped reflector via reflect()", () => {
		const Meta = createPropertyDecorator<string>();

		class Target {
			@Meta("test")
			prop!: string;
		}

		const reflector = Meta.reflect(Target);
		const prop = reflector.properties().find((p) => p.name === "prop");
		expect(prop?.metadata).toEqual(["test"]);
	});
});
