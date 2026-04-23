/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { reflect } from "../../src";
import { ClassTag, MethodRoute, ParamInject, PropertyColumn } from "../fixtures/decorators";

describe("reflect(instance)", () => {
	test("parity with reflect(Class) for every decorator kind", () => {
		@ClassTag("svc")
		class Service {
			@PropertyColumn("varchar")
			name!: string;

			@MethodRoute("/ping")
			ping(@ParamInject("req") _request: unknown): void {}
		}

		const instance = new Service();
		const fromInstance = reflect(instance);

		expect(fromInstance.class<string>(ClassTag.key)).toEqual(reflect(Service).class<string>(ClassTag.key));
		expect(fromInstance.methods<string>(MethodRoute.key)).toEqual(
			reflect(Service).methods<string>(MethodRoute.key)
		);
		expect(fromInstance.properties<string>(PropertyColumn.key)).toEqual(
			reflect(Service).properties<string>(PropertyColumn.key)
		);
		expect(fromInstance.parameters<string>(ParamInject.key)).toEqual(
			reflect(Service).parameters<string>(ParamInject.key)
		);
	});

	test("walks prototype chain for subclass instances", () => {
		class Base {
			@MethodRoute("/inherited")
			inherited(): void {}
		}
		class Child extends Base {}

		const methods = reflect(new Child()).methods<string>(MethodRoute.key);
		expect(methods).toHaveLength(1);
		expect(methods[0]?.name).toBe("inherited");
	});

	test("throws TypeError for invalid targets", () => {
		for (const value of [
			Object.create(null) as object,
			null as unknown as object,
			42 as unknown as object,
			"str" as unknown as object,
			{ constructor: "not a function" } as unknown as object,
			{ constructor: (() => {}) as unknown } as unknown as object,
		]) {
			expect(() => reflect(value)).toThrow(TypeError);
		}
	});
});

describe("factory.reflect(instance)", () => {
	test("resolves the same metadata as the constructor path for all decorator kinds", () => {
		@ClassTag("a")
		class A {}
		const classResults = ClassTag.reflect(new A()).class();
		expect(classResults?.metadata).toEqual(["a"]);

		class Api {
			@MethodRoute("/users")
			getUsers(): void {}
		}
		const methods = MethodRoute.reflect(new Api()).methods();
		expect(methods).toHaveLength(1);
		expect(methods[0]?.name).toBe("getUsers");

		class User {
			@PropertyColumn("varchar")
			name!: string;
		}
		const properties = PropertyColumn.reflect(new User()).properties();
		expect(properties).toHaveLength(1);
		expect(properties[0]?.name).toBe("name");

		class Svc {
			constructor(@ParamInject("db") _db: unknown) {}
		}
		const params = ParamInject.reflect(new Svc(undefined)).parameters();
		expect(params).toHaveLength(1);
		expect(params[0]?.metadata).toEqual(["db"]);
	});

	test("propagates TypeError for invalid instances", () => {
		expect(() => ClassTag.reflect(Object.create(null) as object)).toThrow(TypeError);
	});
});
