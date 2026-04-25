/** biome-ignore-all lint/complexity/noVoid: discard class references to avoid unused-variable warnings in test */
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: stub methods in test fixtures */
import { describe, expect, test } from "bun:test";

import { decorate, intercept, UnregisteredClassError } from "../../../src";

describe("shared reader helpers: all()", () => {
	test("class: unique factory all() returns one-element frozen array; reader metadata is scalar", () => {
		const Tag = decorate.class<string>();
		const Other = decorate.class<string>();

		@Tag("a")
		class T1 {}
		// factory.all() still returns MetadataArray (readonly string[]) — length 1 for unique.
		expect(Tag.all(T1)).toEqual(["a"]);
		expect(Object.isFrozen(Tag.all(T1))).toBe(true);
		// reader.class().metadata is now a scalar (T4: unique-key metadata is unwrapped).
		expect(Tag.reader(T1).class()?.metadata).toBe("a");

		@Other("x")
		class T2 {}
		expect(Tag.all(T2)).toEqual([]);

		class Bare {}
		expect(() => Tag.all(Bare)).toThrow(UnregisteredClassError);
	});

	test("method: unique factory all() returns one-element array; reader metadata is scalar", () => {
		const Route = decorate.method<string>();
		const Other = decorate.method<string>();

		class Api {
			@Route("/a")
			ping(): void {}

			@Other("/o")
			other(): void {}

			absent(): void {}
		}

		new Api();
		// factory.all() returns the full MetadataArray (readonly string[]).
		expect(Route.all(Api, "ping")).toEqual(["/a"]);
		// reader.methods().metadata is now a scalar string for unique keys.
		const entry = Route.reader(Api)
			.methods()
			.find((m) => m.name === "ping");
		expect(entry?.metadata).toBe("/a");
		expect(Route.all(Api, "absent")).toEqual([]);
	});

	test("property: unique factory all() returns one-element array; reader metadata is scalar", () => {
		const Column = decorate.property<string>();
		const Other = decorate.property<string>();

		class User {
			@Column("a")
			name!: string;

			@Other("o")
			other!: string;

			absent!: string;
		}

		new User();
		// factory.all() returns the full MetadataArray (readonly string[]).
		expect(Column.all(User, "name")).toEqual(["a"]);
		// reader.properties().metadata is now a scalar string for unique keys.
		const entry = Column.reader(User)
			.properties()
			.find((p) => p.name === "name");
		expect(entry?.metadata).toBe("a");
		expect(Column.all(User, "absent")).toEqual([]);
	});

	test("method interceptor: unique factory all() returns one-element array; reader metadata is scalar", () => {
		const Trace = intercept.method<string>({
			intercept: (original) => original,
		});

		class Svc {
			@Trace("a")
			run(): void {}
		}

		new Svc();
		// factory.all() returns the full MetadataArray.
		expect(Trace.all(Svc, "run")).toEqual(["a"]);
		// reader.methods().metadata is scalar for unique keys.
		const entry = Trace.reader(Svc)
			.methods()
			.find((m) => m.name === "run");
		expect(entry?.metadata).toBe("a");
	});

	test("accessor interceptor: unique factory all() returns one-element array; reader metadata is scalar", () => {
		const Tag = intercept.accessor<string, [string], number>({
			onGet: (original) =>
				function (this: unknown) {
					return original.call(this);
				},
		});

		class Box {
			@Tag("v")
			accessor x = 0;
		}

		new Box();
		// factory.all() returns the full MetadataArray.
		expect(Tag.all(Box, "x")).toEqual(["v"]);
		// reader.properties().metadata is scalar for unique keys.
		const entry = Tag.reader(Box)
			.properties()
			.find((p) => p.name === "x");
		expect(entry?.metadata).toBe("v");
	});
});
