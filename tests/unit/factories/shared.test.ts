/** biome-ignore-all lint/complexity/noVoid: discard class references to avoid unused-variable warnings in test */
import { describe, expect, test } from "bun:test";

import { createMethodDecorator } from "../../../src/factories/method-decorator";
import { createPropertyDecorator } from "../../../src/factories/property-decorator";

describe("reader prepares deferred instance-member metadata (asymmetry fix)", () => {
	test("reader flushes pending deferred instance members like sibling helpers do", () => {
		const Field = createPropertyDecorator<string>();

		class User {
			@Field("varchar")
			name!: string;

			@Field("text")
			bio!: string;
		}

		const reader = Field.reader(User);
		const properties = reader.properties();

		expect(properties).toHaveLength(2);
		const names = properties.map((p) => p.name);
		expect(names).toContain("name");
		expect(names).toContain("bio");
	});

	test("member reader is prepared like member first() is", () => {
		const Method = createMethodDecorator<string>();

		class Service {
			@Method("endpoint")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			fetch(): void {}

			@Method("handler")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			process(): void {}
		}

		const readerMethods = Method.reader(Service).methods();
		expect(readerMethods).toHaveLength(2);
		const methodNames = readerMethods.map((m) => m.name);
		expect(methodNames).toContain("fetch");
		expect(methodNames).toContain("process");
	});
});
