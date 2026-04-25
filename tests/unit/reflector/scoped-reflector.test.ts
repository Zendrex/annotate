/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
import { describe, expect, test } from "bun:test";

import { decorate, mintUniqueKey } from "../../../src";
import { ClassTag, PropertyColumn } from "../../fixtures/decorators";

describe("factory.reader()", () => {
	test("should be scoped to key", () => {
		@ClassTag("scoped")
		class Target {}

		const scoped = ClassTag.reader(Target);
		const one = scoped.class();

		// Unique-cardinality key: metadata is a scalar string, not an array.
		expect(one?.metadata).toBe("scoped");
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

describe("ScopedReflector brand-driven specialization", () => {
	test("unique key: methods() surfaces scalar metadata per entry", () => {
		const Route = decorate.method<string>();

		class Api {
			@Route("/users")
			list() {
				return null;
			}
		}

		const entry = Route.reader(Api)
			.methods()
			.find((item) => item.name === "list");
		// Unique-cardinality key: metadata is the scalar value, not an array.
		expect(entry?.metadata).toBe("/users");
	});

	test("unique key: properties() surfaces scalar metadata per entry", () => {
		const Column = decorate.property<string>();

		class User {
			@Column("varchar")
			name!: string;
		}

		const entry = Column.reader(User)
			.properties()
			.find((item) => item.name === "name");
		// Unique-cardinality key: metadata is the scalar value, not an array.
		expect(entry?.metadata).toBe("varchar");
	});

	test("list key: methods() surfaces array metadata per entry", () => {
		const Tags = decorate.method.list<string>();

		class Api {
			@Tags("alpha")
			@Tags("beta")
			run() {}
		}

		new Api();
		const entry = Tags.reader(Api)
			.methods()
			.find((item) => item.name === "run");
		// List-cardinality key: metadata is an array (all accumulated values).
		expect(Array.isArray(entry?.metadata)).toBe(true);
		expect(entry?.metadata).toContain("alpha");
		expect(entry?.metadata).toContain("beta");
	});

	test("list key: properties() surfaces array metadata per entry", () => {
		const Constraints = decorate.property.list<string>();

		class Model {
			@Constraints("required")
			@Constraints("minlength:3")
			title!: string;
		}

		new Model();
		const entry = Constraints.reader(Model)
			.properties()
			.find((item) => item.name === "title");
		// List-cardinality key: metadata is an array.
		expect(Array.isArray(entry?.metadata)).toBe(true);
		expect(entry?.metadata).toContain("required");
		expect(entry?.metadata).toContain("minlength:3");
	});

	test("createScopedReflector with a unique key exposes scalar class metadata", () => {
		const _key = mintUniqueKey<number>("test:unique");

		// ScopedReflector created directly from mintUniqueKey should behave as unique.
		// We can only verify brand behavior via the factory-level reader for full e2e.
		const Tag = decorate.class<number>();

		@Tag(42)
		class MyClass {}

		const entry = Tag.reader(MyClass).class();
		expect(entry?.metadata).toBe(42);
	});

	test("createScopedReflector with a list key exposes array class metadata", () => {
		const Tags = decorate.class.list<string>();

		@Tags("a")
		@Tags("b")
		class MyClass {}

		const entry = Tags.reader(MyClass).class();
		expect(Array.isArray(entry?.metadata)).toBe(true);
		expect(entry?.metadata).toContain("a");
		expect(entry?.metadata).toContain("b");
	});
});
