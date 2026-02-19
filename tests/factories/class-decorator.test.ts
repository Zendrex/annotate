import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { createClassDecorator } from "../../src/lib/factories";

describe("createClassDecorator", () => {
	test("should store simple metadata on class", () => {
		const Tag = createClassDecorator<string>();

		@Tag("admin")
		class Controller {}

		const results = Tag.class(Controller);
		expect(results).toHaveLength(1);
		expect(results[0]?.kind).toBe("class");
		expect(results[0]?.metadata).toEqual(["admin"]);
	});

	test("should store multiple metadata on class", () => {
		const Role = createClassDecorator<string>();

		@Role("admin")
		@Role("user")
		class Controller {}

		const results = Role.class(Controller);
		expect(results).toHaveLength(1);
		expect(results[0]?.metadata).toEqual(["user", "admin"]);
	});

	test("should support compose function", () => {
		const Permission = createClassDecorator((name: string, level: number) => ({ name, level }));

		@Permission("write", 2)
		class Service {}

		const results = Permission.class(Service);
		expect(results).toHaveLength(1);
		expect(results[0]?.metadata).toEqual([{ name: "write", level: 2 }]);
	});

	test("should provide scoped reflector via reflect()", () => {
		const Meta = createClassDecorator<string>();

		@Meta("test")
		class Target {}

		const reflector = Meta.reflect(Target);
		const results = reflector.class();
		expect(results).toHaveLength(1);
		expect(results[0]?.metadata).toEqual(["test"]);
	});
});
