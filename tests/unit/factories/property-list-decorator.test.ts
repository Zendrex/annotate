/** biome-ignore-all lint/complexity/noVoid: discard class references to avoid unused-variable warnings */
import { describe, expect, test } from "bun:test";

import { AnnotateError, MissingMetadataError } from "../../../src";
import { decorate } from "../../../src/legacy";

describe("decorate.property.list", () => {
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
