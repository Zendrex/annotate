/** biome-ignore-all lint/complexity/noVoid: discard class references to avoid unused-variable warnings */
import { describe, expect, test } from "bun:test";

import { AnnotateError, decorate, MissingMetadataError } from "../../../src";
import type { ListMetadataKey } from "../../../src";

describe("decorate.property.list", () => {
	test("returns a factory whose .key is assignable to ListMetadataKey<T>", () => {
		const Column = decorate.property.list<string>();
		expect(typeof Column.key).toBe("symbol");

		const _check: ListMetadataKey<string> = Column.key;
		void _check;
	});

	test("two properties decorated with the same .list factory each have 1 entry", () => {
		const Column = decorate.property.list<string>();

		class User {
			@Column("varchar")
			name!: string;

			@Column("int")
			age!: number;
		}

		new User();
		expect(Column.all(User, "name")).toEqual(["varchar"]);
		expect(Column.all(User, "age")).toEqual(["int"]);
	});

	test("one property decorated twice with same .list factory has 2 entries", () => {
		const Column = decorate.property.list<string>();

		class X {
			@Column("first")
			@Column("second")
			value!: string;
		}

		new X();
		expect(Column.all(X, "value")).toHaveLength(2);
		expect(Column.all(X, "value")).toContain("first");
		expect(Column.all(X, "value")).toContain("second");
	});

	test("does NOT throw DuplicateMetadataError on second application (unlike unique factory)", () => {
		const Column = decorate.property.list<string>({ name: "ListColumn" });

		expect(() => {
			class X {
				@Column("a")
				@Column("b")
				value!: string;
			}
			new X();
		}).not.toThrow(AnnotateError);
	});

	test("stacking same unique factory twice still throws DuplicateMetadataError (regression)", () => {
		const Column = decorate.property<string>({ name: "UniqueColumn" });

		expect(() => {
			class X {
				@Column("a")
				@Column("b")
				value!: string;
			}
			new X();
		}).toThrow(AnnotateError);
	});

	test("derive() on a list factory shares the key and keeps list cardinality", () => {
		const Parent = decorate.property.list<string>({ name: "ListPropParent" });
		const Child = Parent.derive();

		expect(Parent.key).toBe(Child.key);

		class Model {
			@Child("child-meta")
			fieldOne!: string;

			@Parent("parent-meta")
			fieldTwo!: string;
		}

		new Model();
		const props = Parent.reader(Model)
			.properties()
			.map((p) => p.name)
			.sort();
		expect(props).toEqual(["fieldOne", "fieldTwo"]);
	});

	test("has() and hasOwn() reflect list entries", () => {
		const Column = decorate.property.list<string>();

		class Parent {
			@Column("p")
			name!: string;
		}
		class Child extends Parent {}

		new Child();
		expect(Column.has(Child, "name")).toBe(true);
		expect(Column.hasOwn(Child, "name")).toBe(false);
		expect(Column.hasOwn(Parent, "name")).toBe(true);
	});

	test("first() returns the first-stored value", () => {
		const Column = decorate.property.list<string>();

		class X {
			@Column("outer")
			@Column("inner")
			value!: string;
		}

		new X();
		// Inner decorator stores first (Stage-3 applies decorators bottom-up)
		expect(Column.first(X, "value")).toBe("inner");
	});

	test("firstOrThrow() returns the first-stored value on a decorated property", () => {
		const Column = decorate.property.list<string>();

		class X {
			@Column("outer")
			@Column("inner")
			value!: string;
		}

		new X();
		// Inner decorator stores first (Stage-3 applies decorators bottom-up)
		expect(Column.firstOrThrow(X, "value")).toBe("inner");
	});

	test("firstOrThrow() throws MissingMetadataError on an undecorated property", () => {
		const Column = decorate.property.list<string>();
		const Other = decorate.property.list<string>();

		class X {
			@Other("x")
			value!: string;
		}

		new X();
		expect(() => Column.firstOrThrow(X, "value")).toThrow(MissingMetadataError);
		expect(() => Column.firstOrThrow(X, "value")).toThrow(AnnotateError);
	});
});
