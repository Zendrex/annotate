/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
import { describe, expect, test } from "bun:test";

import { decorate } from "../../../src/legacy";
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

describe("decorate.class reader — list class() cardinality", () => {
	test("list key: array class metadata", () => {
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
