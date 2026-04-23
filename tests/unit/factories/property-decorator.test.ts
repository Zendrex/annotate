// Temporary: importing directly until Phase M1 consolidates all factory exports into src/index.ts.
import { describe, expect, test } from "bun:test";

import { AnnotateError } from "../../../src/errors";
import { createClassDecorator } from "../../../src/factories/class-decorator";
import { createPropertyDecorator } from "../../../src/factories/property-decorator";
import { materialize } from "../../../src/runtime/materialize";

describe("createPropertyDecorator (Stage-3)", () => {
	test("captures metadata on a decorated field after construction", () => {
		const Column = createPropertyDecorator<string>();

		class User {
			@Column("varchar")
			name!: string;
		}

		new User();
		expect(Column.appliedOwn(User, "name")).toBe(true);
		expect(Column.metadata(User, "name")).toBe("varchar");
	});

	test("eager flush via materialize() makes pre-instantiation reflection work", () => {
		const Column = createPropertyDecorator<string>();

		class User {
			@Column("varchar")
			name!: string;
		}

		materialize(User);
		expect(Column.appliedOwn(User, "name")).toBe(true);
	});

	test("eager flush via class decorator on the same class", () => {
		const Tag = createClassDecorator<string>();
		const Field = createPropertyDecorator<string>();

		@Tag("entity")
		class Entity {
			@Field("varchar")
			name!: string;
		}

		// No new Entity() — class decorator drained pending Deferreds at class-body eval.
		expect(Field.appliedOwn(Entity, "name")).toBe(true);
	});

	test("inheritance: child sees parent field via applied(), not appliedOwn()", () => {
		const Column = createPropertyDecorator<string>();

		class Parent {
			@Column("varchar")
			name!: string;
		}
		class Child extends Parent {}

		new Child();
		expect(Column.appliedOwn(Parent, "name")).toBe(true);
		expect(Column.appliedOwn(Child, "name")).toBe(false);
		expect(Column.applied(Child, "name")).toBe(true);
	});

	test("supports compose for multi-arg call shapes", () => {
		const Column = createPropertyDecorator({
			compose: (type: string, nullable: boolean) => ({ type, nullable }),
		});

		class User {
			@Column("varchar", false)
			name!: string;
		}

		new User();
		expect(Column.metadata(User, "name")).toEqual({ type: "varchar", nullable: false });
	});

	test("unique:true throws on second application to same field", () => {
		const Column = createPropertyDecorator<string>({ unique: true, name: "Column" });

		expect(() => {
			class X {
				@Column("a")
				@Column("b")
				name!: string;
			}
			new X();
		}).toThrow(AnnotateError);
	});

	test("requireMetadata throws AnnotateError(missing) when undecorated", () => {
		const Column = createPropertyDecorator<string>({ name: "Column" });
		class X {
			name!: string;
		}
		new X();
		expect(() => Column.requireMetadata(X, "name")).toThrow(AnnotateError);
	});

	// Skipped: Bun 1.3.13 decorator transpiler emits a shared `_init` variable per
	// module for classes with decorated fields; the later class's initializer
	// overwrites the earlier class's, so A's @Column initializer never fires.
	// Store-level sibling isolation is covered in tests/unit/metadata/store.test.ts.
	// Re-enable when Bun emits per-class scoped initializer variables.
	test.skip("appliedOwn(Sub, 'foo') stays false when subclass decorated a sibling member only", () => {
		const Column = createPropertyDecorator<string>();
		class A {
			@Column("a")
			foo!: string;
		}
		class B extends A {
			@Column("b")
			bar!: string;
		}

		new B();
		expect(Column.appliedOwn(B, "foo")).toBe(false);
		expect(Column.appliedOwn(B, "bar")).toBe(true);
		expect(Column.appliedOwn(A, "foo")).toBe(true);
	});
});
