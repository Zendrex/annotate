/** biome-ignore-all lint/suspicious/noExplicitAny: tests intentionally exercise decorator call shapes */
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test fixture methods */

import { describe, expect, test } from "bun:test";

import { Annotate, InvalidSelectorError } from "../../src";

describe("Annotate", () => {
	test("method annotations are callable decorators and readable through typed selectors", () => {
		const Route = Annotate.method((method: "GET" | "POST", path: string) => ({ method, path }));

		class Api {
			@Route("GET", "/")
			index(): void {}
		}

		expect(Route.read(Api).get((api) => api.index)).toEqual({ method: "GET", path: "/" });
		expect(Route.read(Api).methods()).toEqual([
			{ kind: "method", name: "index", static: false, metadata: { method: "GET", path: "/" } },
		]);
	});

	test("many-cardinality annotations return ordered metadata arrays", () => {
		const Tag = Annotate.method<string>({ cardinality: "many" });

		class Api {
			@Tag("outer")
			@Tag("inner")
			index(): void {}
		}

		expect(Tag.read(Api).get((api) => api.index)).toEqual(["inner", "outer"]);
		expect(Object.isFrozen(Tag.read(Api).get((api) => api.index))).toBe(true);
	});

	test("class annotations read without a selector", () => {
		const Controller = Annotate.class<string>({ label: "Controller" });

		@Controller("users")
		class Users {}

		expect(Controller.read(Users).get()).toBe("users");
		expect(Controller.read(Users).entries()).toEqual([
			{ kind: "class", name: "Users", target: Users, metadata: "users" },
		]);
	});

	test("field and accessor annotations have separate collection helpers", () => {
		const Column = Annotate.field<string>();
		const Watched = Annotate.accessor<string>();

		class User {
			@Column("name")
			name = "";

			@Watched("email")
			accessor email = "";
		}

		expect(Column.read(User).get((user) => user.name)).toBe("name");
		expect(Watched.read(User).get((user) => user.email)).toBe("email");
		expect(Column.read(User).fields()).toEqual([{ kind: "field", name: "name", static: false, metadata: "name" }]);
		expect(Watched.read(User).accessors()).toEqual([
			{ kind: "accessor", name: "email", static: false, metadata: "email" },
		]);
	});

	test("static member reads use constructor selectors", () => {
		const Route = Annotate.method<string>();

		class Api {
			@Route("/health")
			static health(): void {}

			instance(): void {}
		}

		expect(Route.read(Api).static.get((api) => api.health)).toBe("/health");
	});

	test("method interceptors wrap methods and expose cardinality-correct ctx.get", () => {
		const seen: unknown[] = [];
		const Log = Annotate.intercept.method<string>({
			cardinality: "many",
			wrap: (original, ctx) =>
				function (this: object, ...args: unknown[]) {
					seen.push(ctx.get(this));
					return original.apply(this, args as never);
				},
		});

		class Svc {
			@Log("outer")
			@Log("inner")
			run(value: string): string {
				return value.toUpperCase();
			}
		}

		expect(new Svc().run("ok")).toBe("OK");
		expect(seen).toEqual([
			["inner", "outer"],
			["inner", "outer"],
		]);
	});

	test("invalid selectors throw InvalidSelectorError", () => {
		const Route = Annotate.method<string>();

		class Api {
			@Route("/")
			index(): void {}
		}

		expect(() => Route.read(Api).get((api) => api.index())).toThrow(InvalidSelectorError);
		expect(() => Route.read(Api).get(() => undefined as any)).toThrow(InvalidSelectorError);
		expect(() => Route.read(Api).get((api) => [api.index, api.index][0])).toThrow(InvalidSelectorError);
	});
});
