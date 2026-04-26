import { describe, expect, test } from "bun:test";

import {
	AnnotateError,
	DuplicateMetadataError,
	decorate,
	MissingMetadataError,
	prepare,
	UnregisteredClassError,
} from "../../../src";

describe("decorate.property", () => {
	test("captures metadata on a decorated field after construction", () => {
		const Column = decorate.property<string>();

		class User {
			@Column("varchar")
			name!: string;
		}

		new User();
		expect(Column.hasOwn(User, "name")).toBe(true);
		expect(Column.first(User, "name")).toBe("varchar");
		expect(
			Column.reader(User)
				.properties()
				.find((p) => p.name === "name")?.metadata
		).toBe("varchar");
	});

	test("eager flush via prepare() makes pre-instantiation reflection work", () => {
		const Column = decorate.property<string>();

		class User {
			@Column("varchar")
			name!: string;
		}

		prepare(User);
		expect(Column.hasOwn(User, "name")).toBe(true);
	});

	test("inheritance: child sees parent field via has(), not hasOwn()", () => {
		const Column = decorate.property<string>();

		class Parent {
			@Column("varchar")
			name!: string;
		}
		class Child extends Parent {}

		new Child();
		expect(Column.hasOwn(Parent, "name")).toBe(true);
		expect(Column.hasOwn(Child, "name")).toBe(false);
		expect(Column.has(Child, "name")).toBe(true);
	});

	test("supports compose for multi-arg call shapes", () => {
		const Column = decorate.property({
			compose: (type: string, nullable: boolean) => ({ type, nullable }),
		});

		class User {
			@Column("varchar", false)
			name!: string;
		}

		new User();
		expect(Column.first(User, "name")).toEqual({ type: "varchar", nullable: false });
	});

	test("throws DuplicateMetadataError with property kind on duplicate (all factory keys are unique)", () => {
		const Column = decorate.property<string>({ name: "Column" });

		let caught: unknown;
		try {
			class X {
				@Column("a")
				@Column("b")
				name!: string;
			}
			new X();
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(DuplicateMetadataError);
		expect((caught as DuplicateMetadataError).kind).toBe("property");
	});

	test("first() throws UnregisteredClassError when class never decorated", () => {
		const Column = decorate.property<string>({ name: "Column" });
		class X {}
		expect(() => Column.first(X, "anything")).toThrow(UnregisteredClassError);
	});

	test("firstOrThrow throws MissingMetadataError when class registered but member not decorated", () => {
		const Column = decorate.property<string>({ name: "Column" });
		const Other = decorate.property<string>({ name: "Other" });

		class X {
			@Other("o")
			other!: string;
		}

		new X();
		expect(() => Column.firstOrThrow(X, "absent")).toThrow(MissingMetadataError);
		expect(() => Column.firstOrThrow(X, "absent")).toThrow(AnnotateError);
		expect(() => Column.firstOrThrow(X, "absent")).not.toThrow(UnregisteredClassError);
	});

	// Bun can still emit a shared `_init` / broken addInitializer ordering for multiple
	// decorated classes in one scope, which is a real transpiler bug.
	// Annotate resolves registration via the constructor, so has/hasOwn stay correct.
	test("hasOwn(Sub, 'foo') stays false when subclass decorated a sibling member only", () => {
		const Column = decorate.property<string>();
		class A {
			@Column("a")
			foo!: string;
		}
		class B extends A {
			@Column("b")
			bar!: string;
		}

		new B();
		expect(Column.hasOwn(B, "foo")).toBe(false);
		expect(Column.hasOwn(B, "bar")).toBe(true);
		expect(Column.hasOwn(A, "foo")).toBe(true);
	});

	test("hasOwn auto-materializes pending registrations", () => {
		const Column = decorate.property<string>();
		class User {
			@Column("v")
			name!: string;
		}
		// No new User(), no prepare() — hasOwn should still see it via auto-materialize.
		expect(Column.hasOwn(User, "name")).toBe(true);
	});
});
