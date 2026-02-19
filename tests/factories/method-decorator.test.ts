import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { createMethodDecorator } from "../../src/lib/factories";

describe("createMethodDecorator", () => {
	test("should store simple metadata on method", () => {
		const Route = createMethodDecorator<string>();

		class Api {
			@Route("/users")
			getUsers() {
				return [];
			}
		}

		const routes = Route.methods(Api);
		const route = routes.find((r) => r.name === "getUsers");
		expect(route?.metadata).toEqual(["/users"]);
	});

	test("should store metadata on multiple methods", () => {
		const HttpMethod = createMethodDecorator<string>();

		class Api {
			@HttpMethod("GET")
			list() {
				return [];
			}

			@HttpMethod("POST")
			create() {
				return null;
			}
		}

		const methods = HttpMethod.methods(Api);
		expect(methods.find((m) => m.name === "list")?.metadata).toEqual(["GET"]);
		expect(methods.find((m) => m.name === "create")?.metadata).toEqual(["POST"]);
	});

	test("should support compose function", () => {
		const Route = createMethodDecorator((path: string, method: "GET" | "POST") => ({ path, method }));

		class Api {
			@Route("/users", "GET")
			getUsers() {
				return [];
			}
		}

		const routes = Route.methods(Api);
		const route = routes.find((r) => r.name === "getUsers");
		expect(route?.metadata).toEqual([{ path: "/users", method: "GET" }]);
	});

	test("should provide scoped reflector via reflect()", () => {
		const Meta = createMethodDecorator<string>();

		class Target {
			@Meta("test")
			method() {
				return null;
			}
		}

		const reflector = Meta.reflect(Target);
		const method = reflector.methods().find((m) => m.name === "method");
		expect(method?.metadata).toEqual(["test"]);
	});
});
