import { describe, expect, test } from "bun:test";

// Temporary: importing directly until Phase M1 consolidates all factory exports into src/index.ts.
import { AnnotateError } from "../../../src/errors";
import { createMethodDecorator } from "../../../src/factories/method-decorator";

describe("createMethodDecorator (Stage-3)", () => {
	test("stores metadata on instance method after construction", () => {
		const Route = createMethodDecorator<string>();

		class Api {
			@Route("/ping")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			ping(): void {}
		}

		new Api();
		expect(Route.metadata(Api, "ping")).toBe("/ping");
		expect(Route.appliedOwn(Api, "ping")).toBe(true);
	});

	test("static methods are eagerly registered (no instantiation needed)", () => {
		const Cmd = createMethodDecorator<string>();

		// biome-ignore lint/complexity/noStaticOnlyClass: test fixture requires a class with a single static method
		class Cli {
			@Cmd("build")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			static build(): void {}
		}

		expect(Cmd.metadata(Cli, "build")).toBe("build");
		expect(Cmd.appliedOwn(Cli, "build")).toBe(true);
	});

	test("inheritance: child sees parent metadata via applied(), not appliedOwn()", () => {
		const Route = createMethodDecorator<string>();

		class Base {
			@Route("/parent")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			handle(): void {}
		}
		class Child extends Base {}

		new Child();
		expect(Route.applied(Child, "handle")).toBe(true);
		expect(Route.appliedOwn(Child, "handle")).toBe(false);
		expect(Route.appliedOwn(Base, "handle")).toBe(true);
	});

	test("subclass-of-parent-only-decorated: B's bucket stays clean across many constructions", () => {
		const Route = createMethodDecorator<string>();

		class A {
			@Route("/a")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			foo(): void {}
		}
		class B extends A {}

		for (let i = 0; i < 100; i++) {
			if (i % 2 === 0) {
				new A();
			} else {
				new B();
			}
		}
		expect(Route.appliedOwn(A, "foo")).toBe(true);
		expect(Route.appliedOwn(B, "foo")).toBe(false);
		const list = Route.reflect(A).methods()[0]?.metadata;
		expect(list).toEqual(["/a"]);
	});

	test("unique:true throws on second application", () => {
		const Cmd = createMethodDecorator<string>({ unique: true, name: "Cmd" });

		expect(() => {
			// biome-ignore lint/complexity/noStaticOnlyClass: test fixture requires a class with a single static method
			class X {
				@Cmd("a")
				@Cmd("b")
				// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
				static run(): void {}
			}
			// biome-ignore lint/complexity/noVoid: discard class reference to avoid unused-variable warning in test
			void X;
		}).toThrow(AnnotateError);
	});

	test("requireMetadata throws AnnotateError(missing) when undecorated", () => {
		const Route = createMethodDecorator<string>({ name: "Route" });
		class X {
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			plain(): void {}
		}
		new X();
		expect(() => Route.requireMetadata(X, "plain")).toThrow(AnnotateError);
	});
});
