/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
/** biome-ignore-all lint/complexity/noUselessConstructor: test file */
/** biome-ignore-all lint/complexity/noStaticOnlyClass: test file */
import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import { createClassDecorator, createMethodDecorator, createPropertyDecorator, reflect } from "../../../src";
import { ClassTag, MethodRoute, ParamInject, PropertyColumn } from "../../fixtures/decorators";

describe("Reflector (via reflect())", () => {
	describe("class()", () => {
		test("should return undefined when no class metadata exists", () => {
			class Target {}
			const r = reflect(Target);
			expect(r.class(ClassTag.key)).toBeUndefined();
		});

		test("should return class-level metadata", () => {
			@ClassTag("controller")
			class Target {}

			const r = reflect(Target);
			const one = r.class<string>(ClassTag.key);

			expect(one).toBeDefined();
			expect(one?.kind).toBe("class");
			expect(one?.name).toBe("Target");
			expect(one?.metadata).toEqual(["controller"]);
			expect(one?.target).toBe(Target);
		});

		test("should return class with multiple class metadata values", () => {
			@ClassTag("admin")
			@ClassTag("user")
			class Target {}

			const r = reflect(Target);
			const one = r.class<string>(ClassTag.key);

			expect(one?.metadata).toEqual(["user", "admin"]);
		});
	});

	describe("methods()", () => {
		test("should return empty array when no method metadata exists", () => {
			class Target {
				someMethod() {}
			}
			const r = reflect(Target);
			expect(r.methods(MethodRoute.key)).toEqual([]);
		});

		test("should return method metadata", () => {
			class Target {
				@MethodRoute("/users")
				getUsers() {}
			}

			const r = reflect(Target);
			const results = r.methods<string>(MethodRoute.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.kind).toBe("method");
			expect(results[0]?.name).toBe("getUsers");
			expect(results[0]?.static).toBe(false);
			expect(results[0]?.metadata).toEqual(["/users"]);
		});

		test("should return metadata from multiple methods", () => {
			class Target {
				@MethodRoute("/users")
				getUsers() {}

				@MethodRoute("/posts")
				getPosts() {}
			}

			const r = reflect(Target);
			const results = r.methods<string>(MethodRoute.key);

			expect(results).toHaveLength(2);
			const names = results.map((x) => x.name);
			expect(names).toContain("getUsers");
			expect(names).toContain("getPosts");
		});

		test("should return static method metadata", () => {
			class Target {
				@MethodRoute("/static")
				static staticMethod() {}
			}

			const r = reflect(Target);
			const results = r.methods<string>(MethodRoute.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.name).toBe("staticMethod");
			expect(results[0]?.static).toBe(true);
			expect(results[0]?.metadata).toEqual(["/static"]);
		});
	});

	describe("properties()", () => {
		test("should return empty array when no property metadata exists", () => {
			class Target {
				someProperty = "";
			}
			const r = reflect(Target);
			expect(r.properties(PropertyColumn.key)).toEqual([]);
		});

		test("should return property metadata", () => {
			class Target {
				@PropertyColumn("varchar")
				name!: string;
			}

			const r = reflect(Target);
			const results = r.properties<string>(PropertyColumn.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.kind).toBe("property");
			expect(results[0]?.name).toBe("name");
			expect(results[0]?.static).toBe(false);
			expect(results[0]?.metadata).toEqual(["varchar"]);
		});

		test("should return metadata from multiple properties", () => {
			class Target {
				@PropertyColumn("varchar")
				name!: string;

				@PropertyColumn("integer")
				age!: number;
			}

			const r = reflect(Target);
			const results = r.properties<string>(PropertyColumn.key);

			expect(results).toHaveLength(2);
			const names = results.map((x) => x.name);
			expect(names).toContain("name");
			expect(names).toContain("age");
		});

		test("should return static property metadata", () => {
			class Target {
				@PropertyColumn("static-type")
				static staticProp: string;
			}

			const r = reflect(Target);
			const results = r.properties<string>(PropertyColumn.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.name).toBe("staticProp");
			expect(results[0]?.static).toBe(true);
		});
	});

	describe("parameters()", () => {
		test("should return empty array when no parameter metadata exists", () => {
			class Target {
				constructor(_arg: string) {}
			}
			const r = reflect(Target);
			expect(r.parameters(ParamInject.key)).toEqual([]);
		});

		test("should return constructor parameter metadata", () => {
			class Target {
				constructor(@ParamInject("db") _db: unknown) {}
			}

			const r = reflect(Target);
			const results = r.parameters<string>(ParamInject.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.kind).toBe("constructor-parameter");
			expect(results[0]?.parameterIndex).toBe(0);
			expect(results[0]?.metadata).toEqual(["db"]);
		});

		test("should return method parameter metadata", () => {
			class Target {
				handle(@ParamInject("service") _svc: unknown) {}
			}

			const r = reflect(Target);
			const results = r.parameters<string>(ParamInject.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.kind).toBe("method-parameter");
			if (results[0]?.kind === "method-parameter") {
				expect(results[0].methodName).toBe("handle");
				expect(results[0].static).toBe(false);
			}
			expect(results[0] && "parameterIndex" in results[0] && results[0].parameterIndex).toBe(0);
		});

		test("should return multiple parameter metadata", () => {
			class Target {
				constructor(@ParamInject("first") _a: unknown, @ParamInject("second") _b: unknown) {}
			}

			const r = reflect(Target);
			const results = r.parameters<string>(ParamInject.key);

			expect(results).toHaveLength(2);
			const indexes = results.map((x) => x.parameterIndex);
			expect(indexes).toContain(0);
			expect(indexes).toContain(1);
		});
	});

	describe("all()", () => {
		test("should combine class, method, property, and parameter metadata", () => {
			const Tag = createClassDecorator<{ type: string }>();
			const Route = createMethodDecorator<{ type: string }>();
			const Column = createPropertyDecorator<{ type: string }>();

			@Tag({ type: "class" })
			class Target {
				@Column({ type: "property" })
				field!: string;

				@Route({ type: "method" })
				action() {}
			}

			const tagR = reflect(Target);
			const routeR = reflect(Target);
			const colR = reflect(Target);

			expect(tagR.all(Tag.key).some((r) => r.kind === "class")).toBe(true);
			expect(routeR.all(Route.key).some((r) => r.kind === "method")).toBe(true);
			expect(colR.all(Column.key).some((r) => r.kind === "property")).toBe(true);
		});
	});
});

describe("reflect()", () => {
	test("returns a reflector with expected shape", () => {
		class Target {}
		const r = reflect(Target);
		expect(typeof r.all).toBe("function");
		expect(typeof r.class).toBe("function");
	});
});

describe("inheritance support", () => {
	test("should walk prototype chain for method metadata", () => {
		const Inherited = createMethodDecorator<string>();

		class Parent {
			@Inherited("parent-method")
			parentMethod() {}
		}

		class Child extends Parent {
			@Inherited("child-method")
			childMethod() {}
		}

		const r = reflect(Child);
		const results = r.methods<string>(Inherited.key);

		const names = results.map((x) => x.name);
		expect(names).toContain("childMethod");
		expect(names).toContain("parentMethod");
	});

	test("should walk prototype chain for property metadata", () => {
		const InheritedProp = createPropertyDecorator<string>();

		class Parent {
			@InheritedProp("parent-prop")
			parentField!: string;
		}

		class Child extends Parent {
			@InheritedProp("child-prop")
			childField!: string;
		}

		const r = reflect(Child);
		const results = r.properties<string>(InheritedProp.key);

		const names = results.map((x) => x.name);
		expect(names).toContain("childField");
		expect(names).toContain("parentField");
	});
});
