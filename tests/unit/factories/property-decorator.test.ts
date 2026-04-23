import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { AnnotateError, createPropertyDecorator } from "../../../src";

describe("createPropertyDecorator", () => {
	test("should store simple metadata on property", () => {
		const Column = createPropertyDecorator<string>();

		class User {
			@Column("varchar")
			name!: string;
		}

		const columns = Column.reflect(User).properties();
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

		const fields = Field.reflect(Entity).properties();
		expect(fields.find((f) => f.name === "name")?.metadata).toEqual(["string"]);
		expect(fields.find((f) => f.name === "age")?.metadata).toEqual(["number"]);
	});

	test("should support compose function", () => {
		const Column = createPropertyDecorator({
			compose: (type: string, nullable: boolean) => ({ type, nullable }),
		});

		class User {
			@Column("varchar", false)
			name!: string;
		}

		const columns = Column.reflect(User).properties();
		const column = columns.find((c) => c.name === "name");
		expect(column?.metadata).toEqual([{ type: "varchar", nullable: false }]);
	});

	describe("propertiesSingular", () => {
		test("should unwrap metadata to singular value with kind", () => {
			const Column = createPropertyDecorator<string>();

			class User {
				@Column("varchar")
				name!: string;

				@Column("int")
				age!: number;
			}

			const entries = Column.reflect(User).propertiesSingular();
			expect(entries.find((entry) => entry.name === "name")?.metadata).toBe("varchar");
			expect(entries.find((entry) => entry.name === "age")?.metadata).toBe("int");
			expect(entries[0]?.kind).toBe("property");
		});

		test("should omit undecorated properties", () => {
			const Column = createPropertyDecorator<string>();

			class User {
				@Column("varchar")
				name!: string;
				age!: number;
			}

			const names = Column.reflect(User)
				.propertiesSingular()
				.map((entry) => entry.name);
			expect(names).toEqual(["name"]);
		});
	});

	describe("metadata", () => {
		test("should return undefined for undecorated property", () => {
			const Column = createPropertyDecorator<string>();

			class User {
				name!: string;
			}

			expect(Column.metadata(User, "name")).toBeUndefined();
		});

		test("should return the first applied value when stacked", () => {
			const Field = createPropertyDecorator<string>();

			class Entity {
				@Field("second")
				@Field("first")
				name!: string;
			}

			expect(Field.metadata(Entity, "name")).toBe("first");
		});

		test("should inherit from an ancestor property", () => {
			const Column = createPropertyDecorator<string>();

			class Parent {
				@Column("varchar")
				name!: string;
			}

			class Child extends Parent {}

			expect(Column.metadata(Child, "name")).toBe("varchar");
		});

		test("should resolve static properties", () => {
			const Config = createPropertyDecorator<string>();

			class App {
				run() {
					return null;
				}

				@Config("prod")
				static env: string;
			}

			expect(Config.metadata(App, "env")).toBe("prod");
		});
	});

	describe("requireMetadata", () => {
		test("should throw AnnotateError with code, kind, and target when property has no metadata", () => {
			const Column = createPropertyDecorator<string>();

			class User {
				name!: string;
			}

			expect(() => Column.requireMetadata(User, "name")).toThrow(AnnotateError);

			try {
				Column.requireMetadata(User, "missing");
				throw new Error("expected AnnotateError");
			} catch (error) {
				expect(error).toBeInstanceOf(AnnotateError);
				const err = error as AnnotateError;
				expect(err.code).toBe("missing");
				expect(err.kind).toBe("property");
				expect(err.target).toBe(User);
				expect(err.memberName).toBe("missing");
				expect(err.message).toContain("missing");
				expect(err.message).toContain("User");
			}
		});
	});
});
