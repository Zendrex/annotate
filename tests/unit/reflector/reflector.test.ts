/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
import { describe, expect, test } from "bun:test";

// biome-ignore lint/correctness/noUnusedImports: kept per plan L2 test spec; referenced by auto-materialize test behavior transitively.
import { prepare, reflect, UnregisteredClassError } from "../../../src";
import { decorate } from "../../../src/legacy";

describe("Reflector", () => {
	test("class() returns undefined when factory not applied (but class has other metadata)", () => {
		const Tag = decorate.class<string>();
		const Other = decorate.class<string>();

		@Other("o")
		class X {}

		expect(reflect(X).class<string>(Tag.key)).toBeUndefined();
	});

	test("methods() collects own + ancestor entries, most-derived-first", () => {
		const Route = decorate.method<string>();

		// Classes are function-scoped to work around a Bun 1.3.13 transpiler bug that
		// emits a shared `var _init` per module scope: when two decorated classes live
		// in the same scope, the later class's init array overwrites the earlier one's,
		// so ancestor initializers never fire on subclass instantiation. Isolating each
		// class in its own function gives Bun distinct `_init` variables per scope.
		// See also tests/unit/factories/property-decorator.test.ts:105 (same bug class).
		function makeA() {
			class A {
				@Route("/a")
				run(): void {}
			}
			return A;
		}
		const A = makeA();

		function makeB(Parent: typeof A) {
			class B extends Parent {
				@Route("/b")
				override run(): void {}
			}
			return B;
		}
		const B = makeB(A);

		new B();
		new A();
		const methods = reflect(B).methods<string>(Route.key);
		const run = methods.find((m) => m.name === "run");
		// Unique key: most-derived-first metadata is "/b" (only the first/own value per site).
		expect(run?.metadata).toBe("/b");
	});

	test("throws UnregisteredClassError when class never decorated", () => {
		class Bare {}
		expect(() => reflect(Bare).methods(Symbol("k") as any)).toThrow(UnregisteredClassError);
	});

	test("auto-materialize: properties() of an instance-member-only class works pre-instantiation", () => {
		const Field = decorate.property<string>();

		class User {
			@Field("varchar")
			name!: string;
		}

		const props = reflect(User).properties<string>(Field.key);
		expect(props).toHaveLength(1);
		expect(props[0]?.name).toBe("name");
	});

	test("static and instance methods coexist; static carries the static flag", () => {
		const Cmd = decorate.method<string>();

		class Cli {
			@Cmd("inst")
			run(): void {}
			@Cmd("st")
			static build(): void {}
		}

		new Cli();
		const methods = reflect(Cli).methods<string>(Cmd.key);
		expect(methods.find((m) => m.name === "run")?.static).toBe(false);
		expect(methods.find((m) => m.name === "build")?.static).toBe(true);
	});

	// Regression: instance field named `name` (or any collision with built-in
	// constructor own-properties like `length`/`prototype`) was misclassified
	// as static because the old classifier used `Object.hasOwn(ctor, name)`.
	test("instance field named 'name' is classified as instance, not static", () => {
		const Field = decorate.property<string>();

		class User {
			@Field("v")
			name!: string;
		}

		const props = reflect(User).properties<string>(Field.key);
		expect(props).toHaveLength(1);
		expect(props[0]?.static).toBe(false);
	});
});
