/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
import { describe, expect, test } from "bun:test";

import {
	createAccessorInterceptor,
	createClassDecorator,
	createMethodDecorator,
	createPropertyDecorator,
	materialize,
} from "../../src";

describe("materialization paths", () => {
	test("eager via class decorator: properties visible pre-instantiation", () => {
		const Tag = createClassDecorator<string>();
		const Field = createPropertyDecorator<string>();

		@Tag("svc")
		class X {
			@Field("v")
			name!: string;
		}

		expect(Field.appliedOwn(X, "name")).toBe(true);
	});

	test("eager via static decorator: instance fields visible pre-instantiation", () => {
		const StaticCmd = createMethodDecorator<string>();
		const Field = createPropertyDecorator<string>();

		class X {
			@Field("v")
			name!: string;

			@StaticCmd("build")
			static run(): void {}
		}

		expect(Field.appliedOwn(X, "name")).toBe(true);
	});

	test("lazy: instance-member-only class becomes visible after first construction", () => {
		const Field = createPropertyDecorator<string>();

		class X {
			@Field("v")
			name!: string;
		}

		// Lazy path: appliedOwn auto-materializes.
		expect(Field.appliedOwn(X, "name")).toBe(true);
	});

	test("explicit materialize() works for plain instance-member-only classes", () => {
		const Field = createPropertyDecorator<string>();

		class X {
			@Field("v")
			name!: string;
		}

		materialize(X);
		expect(Field.appliedOwn(X, "name")).toBe(true);
	});

	test("idempotent: 100 constructions yield exactly one entry per decoration", () => {
		const Field = createPropertyDecorator<string>();

		class X {
			@Field("v")
			name!: string;
		}

		for (let i = 0; i < 100; i++) {
			new X();
		}
		const list = Field.reflect(X).properties();
		expect(list[0]?.metadata).toEqual(["v"]);
	});
});

describe("subclass-of-parent-only-decorated regression", () => {
	test("property-decorator path", () => {
		const Field = createPropertyDecorator<string>();
		class A {
			@Field("a")
			foo!: number;
		}
		class B extends A {}

		new B();
		expect(Field.appliedOwn(A, "foo")).toBe(true);
		expect(Field.appliedOwn(B, "foo")).toBe(false);
		expect(Field.applied(B, "foo")).toBe(true);

		// reflect(B).properties() returns foo exactly once
		const props = Field.reflect(B).properties();
		expect(props).toHaveLength(1);
		expect(props[0]?.name).toBe("foo");
	});

	test("method-decorator path", () => {
		const Route = createMethodDecorator<string>();
		class A {
			@Route("/a")
			run(): void {}
		}
		class B extends A {}

		new B();
		expect(Route.appliedOwn(A, "run")).toBe(true);
		expect(Route.appliedOwn(B, "run")).toBe(false);
		expect(Route.applied(B, "run")).toBe(true);
	});

	test("accessor-interceptor path", () => {
		const Tag = createAccessorInterceptor<string>({
			onGet: (original) =>
				function (this: unknown) {
					return original.call(this);
				},
		});
		class A {
			@Tag("a")
			accessor x = 0;
		}
		class B extends A {}

		const b = new B();
		// biome-ignore lint/complexity/noVoid: discard accessor read to trigger onGet in test
		void b.x;
		expect(Tag.appliedOwn(A, "x")).toBe(true);
		expect(Tag.appliedOwn(B, "x")).toBe(false);
		expect(Tag.applied(B, "x")).toBe(true);
	});

	test("token-dedup invariant across interleaved constructions", () => {
		const Field = createPropertyDecorator<string>();
		class A {
			@Field("a")
			foo!: number;
		}
		class B extends A {}

		for (let i = 0; i < 100; i++) {
			if (i % 3 === 0) {
				new A();
			} else {
				new B();
			}
		}
		const list = Field.reflect(A).properties();
		expect(list[0]?.metadata).toEqual(["a"]);
		expect(Field.appliedOwn(B, "foo")).toBe(false);
	});

	test("cross-hierarchy contamination check", () => {
		const FieldA = createPropertyDecorator<string>();
		const FieldC = createPropertyDecorator<string>();
		class A {
			@FieldA("a")
			foo!: number;
		}
		class B extends A {}
		class C {
			@FieldC("c")
			bar!: string;
		}

		new C();
		new B();
		expect(FieldA.appliedOwn(C, "foo")).toBe(false);
		expect(FieldA.appliedOwn(C, "bar")).toBe(false);
		expect(FieldC.appliedOwn(A, "bar")).toBe(false);
	});
});
