/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
/** biome-ignore-all lint/complexity/noUselessConstructor: test file */
/** biome-ignore-all lint/complexity/noStaticOnlyClass: test file */
import "reflect-metadata";

import { describe, expect, test } from "bun:test";

import {
	createClassDecorator,
	createMethodDecorator,
	createParameterDecorator,
	createPropertyDecorator,
} from "../src/lib/factories";
import { createScopedReflector, Reflector, reflect } from "../src/lib/reflector";

// Test decorators
const ClassTag = createClassDecorator<string>();
const MethodRoute = createMethodDecorator<string>();
const PropertyColumn = createPropertyDecorator<string>();
const ParamInject = createParameterDecorator<string>();

describe("Reflector", () => {
	describe("constructor", () => {
		test("should create a Reflector instance for a class", () => {
			class Target {}
			const reflector = new Reflector(Target);
			expect(reflector).toBeInstanceOf(Reflector);
		});
	});

	describe("class()", () => {
		test("should return empty array when no class metadata exists", () => {
			class Target {}
			const reflector = new Reflector(Target);
			const results = reflector.class(ClassTag.key);
			expect(results).toEqual([]);
		});

		test("should return class-level metadata", () => {
			@ClassTag("controller")
			class Target {}

			const reflector = new Reflector(Target);
			const results = reflector.class<string>(ClassTag.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.kind).toBe("class");
			expect(results[0]?.name).toBe("constructor");
			expect(results[0]?.metadata).toEqual(["controller"]);
			expect(results[0]?.target).toBe(Target);
		});

		test("should return multiple class metadata entries", () => {
			@ClassTag("admin")
			@ClassTag("user")
			class Target {}

			const reflector = new Reflector(Target);
			const results = reflector.class<string>(ClassTag.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.metadata).toEqual(["user", "admin"]);
		});
	});

	describe("methods()", () => {
		test("should return empty array when no method metadata exists", () => {
			class Target {
				someMethod() {}
			}
			const reflector = new Reflector(Target);
			const results = reflector.methods(MethodRoute.key);
			expect(results).toEqual([]);
		});

		test("should return method metadata", () => {
			class Target {
				@MethodRoute("/users")
				getUsers() {}
			}

			const reflector = new Reflector(Target);
			const results = reflector.methods<string>(MethodRoute.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.kind).toBe("method");
			expect(results[0]?.name).toBe("getUsers");
			expect(results[0]?.metadata).toEqual(["/users"]);
		});

		test("should return metadata from multiple methods", () => {
			class Target {
				@MethodRoute("/users")
				getUsers() {}

				@MethodRoute("/posts")
				getPosts() {}
			}

			const reflector = new Reflector(Target);
			const results = reflector.methods<string>(MethodRoute.key);

			expect(results).toHaveLength(2);
			const names = results.map((r) => r.name);
			expect(names).toContain("getUsers");
			expect(names).toContain("getPosts");
		});

		test("should return static method metadata", () => {
			class Target {
				@MethodRoute("/static")
				static staticMethod() {}
			}

			const reflector = new Reflector(Target);
			const results = reflector.methods<string>(MethodRoute.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.name).toBe("staticMethod");
			expect(results[0]?.metadata).toEqual(["/static"]);
		});
	});

	describe("properties()", () => {
		test("should return empty array when no property metadata exists", () => {
			class Target {
				someProperty = "";
			}
			const reflector = new Reflector(Target);
			const results = reflector.properties(PropertyColumn.key);
			expect(results).toEqual([]);
		});

		test("should return property metadata", () => {
			class Target {
				@PropertyColumn("varchar")
				name!: string;
			}

			const reflector = new Reflector(Target);
			const results = reflector.properties<string>(PropertyColumn.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.kind).toBe("property");
			expect(results[0]?.name).toBe("name");
			expect(results[0]?.metadata).toEqual(["varchar"]);
		});

		test("should return metadata from multiple properties", () => {
			class Target {
				@PropertyColumn("varchar")
				name!: string;

				@PropertyColumn("integer")
				age!: number;
			}

			const reflector = new Reflector(Target);
			const results = reflector.properties<string>(PropertyColumn.key);

			expect(results).toHaveLength(2);
			const names = results.map((r) => r.name);
			expect(names).toContain("name");
			expect(names).toContain("age");
		});

		test("should return static property metadata", () => {
			class Target {
				@PropertyColumn("static-type")
				static staticProp: string;
			}

			const reflector = new Reflector(Target);
			const results = reflector.properties<string>(PropertyColumn.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.name).toBe("staticProp");
		});
	});

	describe("parameters()", () => {
		test("should return empty array when no parameter metadata exists", () => {
			class Target {
				constructor(_arg: string) {}
			}
			const reflector = new Reflector(Target);
			const results = reflector.parameters(ParamInject.key);
			expect(results).toEqual([]);
		});

		test("should return constructor parameter metadata", () => {
			class Target {
				constructor(@ParamInject("db") _db: unknown) {}
			}

			const reflector = new Reflector(Target);
			const results = reflector.parameters<string>(ParamInject.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.kind).toBe("parameter");
			expect(results[0]?.name).toBe("constructor");
			expect(results[0]?.parameterIndex).toBe(0);
			expect(results[0]?.metadata).toEqual(["db"]);
		});

		test("should return method parameter metadata", () => {
			class Target {
				handle(@ParamInject("service") _svc: unknown) {}
			}

			const reflector = new Reflector(Target);
			const results = reflector.parameters<string>(ParamInject.key);

			expect(results).toHaveLength(1);
			expect(results[0]?.name).toBe("handle");
			expect(results[0]?.parameterIndex).toBe(0);
		});

		test("should return multiple parameter metadata", () => {
			class Target {
				constructor(@ParamInject("first") _a: unknown, @ParamInject("second") _b: unknown) {}
			}

			const reflector = new Reflector(Target);
			const results = reflector.parameters<string>(ParamInject.key);

			expect(results).toHaveLength(2);
			const indexes = results.map((r) => r.parameterIndex);
			expect(indexes).toContain(0);
			expect(indexes).toContain(1);
		});
	});

	describe("all()", () => {
		test("should return all decorated items for a key", () => {
			const MultiKey = createMethodDecorator<string>();

			class Target {
				@MultiKey("method1")
				first() {}

				@MultiKey("method2")
				second() {}
			}

			const reflector = new Reflector(Target);
			const results = reflector.all<string>(MultiKey.key);

			expect(results.length).toBeGreaterThanOrEqual(2);
		});

		test("should combine class, method, property, and parameter metadata", () => {
			// Create decorators that share the same key type for testing
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

			const tagReflector = new Reflector(Target);
			const routeReflector = new Reflector(Target);
			const columnReflector = new Reflector(Target);

			const tagResults = tagReflector.all(Tag.key);
			const routeResults = routeReflector.all(Route.key);
			const columnResults = columnReflector.all(Column.key);

			expect(tagResults.some((r) => r.kind === "class")).toBe(true);
			expect(routeResults.some((r) => r.kind === "method")).toBe(true);
			expect(columnResults.some((r) => r.kind === "property")).toBe(true);
		});
	});
});

describe("reflect()", () => {
	test("should create a Reflector instance", () => {
		class Target {}
		const reflector = reflect(Target);
		expect(reflector).toBeInstanceOf(Reflector);
	});

	test("should provide access to class metadata", () => {
		@ClassTag("tagged")
		class Target {}

		const results = reflect(Target).class<string>(ClassTag.key);
		expect(results).toHaveLength(1);
		expect(results[0]?.metadata).toEqual(["tagged"]);
	});

	test("should provide access to method metadata", () => {
		class Target {
			@MethodRoute("/api")
			handler() {}
		}

		const results = reflect(Target).methods<string>(MethodRoute.key);
		expect(results).toHaveLength(1);
		expect(results[0]?.metadata).toEqual(["/api"]);
	});
});

describe("createScopedReflector()", () => {
	test("should create a scoped reflector pre-bound to a key", () => {
		@ClassTag("scoped")
		class Target {}

		const scoped = createScopedReflector<string>(Target, ClassTag.key);
		const results = scoped.class();

		expect(results).toHaveLength(1);
		expect(results[0]?.metadata).toEqual(["scoped"]);
	});

	test("should provide all() method without key argument", () => {
		const Route = createMethodDecorator<string>();

		class Target {
			@Route("/a")
			methodA() {}

			@Route("/b")
			methodB() {}
		}

		const scoped = createScopedReflector<string>(Target, Route.key);
		const results = scoped.all();

		expect(results.length).toBeGreaterThanOrEqual(2);
	});

	test("should provide methods() without key argument", () => {
		class Target {
			@MethodRoute("/endpoint")
			endpoint() {}
		}

		const scoped = createScopedReflector<string>(Target, MethodRoute.key);
		const results = scoped.methods();

		expect(results).toHaveLength(1);
		expect(results[0]?.name).toBe("endpoint");
	});

	test("should provide properties() without key argument", () => {
		class Target {
			@PropertyColumn("text")
			field!: string;
		}

		const scoped = createScopedReflector<string>(Target, PropertyColumn.key);
		const results = scoped.properties();

		expect(results).toHaveLength(1);
		expect(results[0]?.name).toBe("field");
	});

	test("should provide parameters() without key argument", () => {
		class Target {
			constructor(@ParamInject("token") _token: unknown) {}
		}

		const scoped = createScopedReflector<string>(Target, ParamInject.key);
		const results = scoped.parameters();

		expect(results).toHaveLength(1);
		expect(results[0]?.name).toBe("constructor");
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

		const reflector = new Reflector(Child);
		const results = reflector.methods<string>(Inherited.key);

		const names = results.map((r) => r.name);
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

		const reflector = new Reflector(Child);
		const results = reflector.properties<string>(InheritedProp.key);

		const names = results.map((r) => r.name);
		expect(names).toContain("childField");
		expect(names).toContain("parentField");
	});
});
