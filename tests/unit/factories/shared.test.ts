/** biome-ignore-all lint/complexity/noVoid: discard class references to avoid unused-variable warnings in test */
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: stub methods in test fixtures */
import { describe, expect, test } from "bun:test";

import { decorate, intercept, UnregisteredClassError } from "../../../src";

describe("shared reader helpers: all()", () => {
	test("class: parity, empty, frozen, unregistered", () => {
		const Tag = decorate.class<string>();
		const Other = decorate.class<string>();

		@Tag("a")
		@Tag("b")
		class T1 {}
		expect(Tag.all(T1)).toEqual(Tag.reader(T1).class()?.metadata ?? []);
		expect(Object.isFrozen(Tag.all(T1))).toBe(true);

		@Other("x")
		class T2 {}
		expect(Tag.all(T2)).toEqual([]);

		class Bare {}
		expect(() => Tag.all(Bare)).toThrow(UnregisteredClassError);
	});

	test("method: parity and empty (errors/frozen follow class case)", () => {
		const Route = decorate.method<string>();
		const Other = decorate.method<string>();

		class Api {
			@Route("/a")
			@Route("/b")
			ping(): void {}

			@Other("/o")
			other(): void {}

			absent(): void {}
		}

		new Api();
		const entry = Route.reader(Api)
			.methods()
			.find((m) => m.name === "ping");
		expect(Route.all(Api, "ping")).toEqual(entry?.metadata ?? []);
		expect(Route.all(Api, "absent")).toEqual([]);
	});

	test("property: parity and empty", () => {
		const Column = decorate.property<string>();
		const Other = decorate.property<string>();

		class User {
			@Column("a")
			@Column("b")
			name!: string;

			@Other("o")
			other!: string;

			absent!: string;
		}

		new User();
		const entry = Column.reader(User)
			.properties()
			.find((p) => p.name === "name");
		expect(Column.all(User, "name")).toEqual(entry?.metadata ?? []);
		expect(Column.all(User, "absent")).toEqual([]);
	});

	test("method interceptor: parity", () => {
		const Trace = intercept.method<string>({
			intercept: (original) => original,
		});

		class Svc {
			@Trace("a")
			run(): void {}
		}

		new Svc();
		const entry = Trace.reader(Svc)
			.methods()
			.find((m) => m.name === "run");
		expect(Trace.all(Svc, "run")).toEqual(entry?.metadata ?? []);
	});

	test("accessor interceptor: parity", () => {
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
		const entry = Tag.reader(Box)
			.properties()
			.find((p) => p.name === "x");
		expect(Tag.all(Box, "x")).toEqual(entry?.metadata ?? []);
	});
});
