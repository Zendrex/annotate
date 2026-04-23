import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { AnnotateError, createMethodDecorator } from "../../../src";

describe("createMethodDecorator", () => {
	test("should store simple metadata on method", () => {
		const Route = createMethodDecorator<string>();

		class Api {
			@Route("/users")
			getUsers() {
				return [];
			}
		}

		const routes = Route.reflect(Api).methods();
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

		const methods = HttpMethod.reflect(Api).methods();
		expect(methods.find((m) => m.name === "list")?.metadata).toEqual(["GET"]);
		expect(methods.find((m) => m.name === "create")?.metadata).toEqual(["POST"]);
	});

	test("should support compose function", () => {
		const Route = createMethodDecorator({
			compose: (path: string, method: "GET" | "POST") => ({ path, method }),
		});

		class Api {
			@Route("/users", "GET")
			getUsers() {
				return [];
			}
		}

		const routes = Route.reflect(Api).methods();
		const route = routes.find((r) => r.name === "getUsers");
		expect(route?.metadata).toEqual([{ path: "/users", method: "GET" }]);
	});

	describe("methodsSingular", () => {
		test("should unwrap metadata to singular value with kind (no method target field)", () => {
			const Route = createMethodDecorator<string>();

			class Api {
				@Route("/users")
				list() {
					return [];
				}

				@Route("/users/:id")
				get() {
					return null;
				}
			}

			const entries = Route.reflect(Api).methodsSingular();
			const list = entries.find((entry) => entry.name === "list");
			const getEntry = entries.find((entry) => entry.name === "get");
			expect(list?.metadata).toBe("/users");
			expect(getEntry?.metadata).toBe("/users/:id");
			expect(list?.kind).toBe("method");
			expect("target" in (list ?? {})).toBe(false);
		});

		test("should omit undecorated methods", () => {
			const Route = createMethodDecorator<string>();

			class Api {
				@Route("/decorated")
				decorated() {
					return null;
				}

				plain() {
					return null;
				}
			}

			const entries = Route.reflect(Api).methodsSingular();
			expect(entries.map((entry) => entry.name)).toEqual(["decorated"]);
		});

		test("should include static methods", () => {
			const Task = createMethodDecorator<string>();

			class Worker {
				@Task("cleanup")
				static cleanup() {
					return null;
				}

				run() {
					return null;
				}
			}

			const entry = Task.reflect(Worker)
				.methodsSingular()
				.find((item) => item.name === "cleanup");
			expect(entry?.metadata).toBe("cleanup");
		});
	});

	describe("metadata", () => {
		test("should return undefined for undecorated method", () => {
			const Route = createMethodDecorator<string>();

			class Api {
				handler() {
					return null;
				}
			}

			expect(Route.metadata(Api, "handler")).toBeUndefined();
		});

		test("should return the first applied value when decorated multiple times", () => {
			const Route = createMethodDecorator<string>();

			class Api {
				@Route("second")
				@Route("first")
				handle() {
					return null;
				}
			}

			expect(Route.metadata(Api, "handle")).toBe("first");
		});

		test("should inherit from an ancestor method", () => {
			const Route = createMethodDecorator<string>();

			class Parent {
				@Route("/base")
				list() {
					return null;
				}
			}

			class Child extends Parent {}

			expect(Route.metadata(Child, "list")).toBe("/base");
		});

		test("should prefer own metadata over inherited", () => {
			const Route = createMethodDecorator<string>();

			class Parent {
				@Route("/parent")
				list() {
					return null;
				}
			}

			class Child extends Parent {
				@Route("/child")
				override list() {
					return null;
				}
			}

			expect(Route.metadata(Child, "list")).toBe("/child");
			expect(Route.metadata(Parent, "list")).toBe("/parent");
		});

		test("should resolve static methods", () => {
			const Task = createMethodDecorator<string>();

			class Worker {
				run() {
					return null;
				}

				@Task("cleanup")
				static cleanup() {
					return null;
				}
			}

			expect(Task.metadata(Worker, "cleanup")).toBe("cleanup");
		});

		test("should prefer instance over static when both exist", () => {
			const Tag = createMethodDecorator<string>();

			class Dual {
				@Tag("instance")
				handler() {
					return null;
				}

				@Tag("static")
				static handler() {
					return null;
				}
			}

			expect(Tag.metadata(Dual, "handler")).toBe("instance");
		});
	});

	describe("requireMetadata", () => {
		test("should throw AnnotateError with code, kind, and target when method has no metadata", () => {
			const Route = createMethodDecorator<string>();

			class Api {
				plain() {
					return null;
				}
			}

			expect(() => Route.requireMetadata(Api, "plain")).toThrow(AnnotateError);

			try {
				Route.requireMetadata(Api, "missing");
				throw new Error("expected AnnotateError");
			} catch (error) {
				expect(error).toBeInstanceOf(AnnotateError);
				const err = error as AnnotateError;
				expect(err.code).toBe("missing");
				expect(err.kind).toBe("method");
				expect(err.target).toBe(Api);
				expect(err.memberName).toBe("missing");
				expect(err.message).toContain("missing");
				expect(err.message).toContain("Api");
			}
		});
	});
});
