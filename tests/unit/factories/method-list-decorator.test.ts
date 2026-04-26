/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test stub methods */
/** biome-ignore-all lint/complexity/noVoid: discard class references to avoid unused-variable warnings */
import { describe, expect, test } from "bun:test";

import { AnnotateError, decorate, MissingMetadataError } from "../../../src";
import type { ListMetadataKey } from "../../../src";

describe("decorate.method.list", () => {
	test("returns a factory whose .key is assignable to ListMetadataKey<T>", () => {
		const Route = decorate.method.list<string>();
		expect(typeof Route.key).toBe("symbol");

		const _check: ListMetadataKey<string> = Route.key;
		void _check;
	});

	test("two methods decorated with the same .list factory each have 1 entry", () => {
		const Route = decorate.method.list<string>();

		class Api {
			@Route("/ping")
			ping(): void {}

			@Route("/pong")
			pong(): void {}
		}

		new Api();
		expect(Route.all(Api, "ping")).toEqual(["/ping"]);
		expect(Route.all(Api, "pong")).toEqual(["/pong"]);
	});

	test("one method decorated twice with same .list factory has 2 entries", () => {
		const Route = decorate.method.list<string>();

		class Api {
			@Route("/a")
			@Route("/b")
			handle(): void {}
		}

		new Api();
		expect(Route.all(Api, "handle")).toHaveLength(2);
		expect(Route.all(Api, "handle")).toContain("/a");
		expect(Route.all(Api, "handle")).toContain("/b");
	});

	test("does NOT throw DuplicateMetadataError on second application (unlike unique factory)", () => {
		const Cmd = decorate.method.list<string>({ name: "ListCmd" });

		expect(() => {
			// biome-ignore lint/complexity/noStaticOnlyClass: test fixture requires a class with a static method
			class X {
				@Cmd("a")
				@Cmd("b")
				static run(): void {}
			}
			void X;
		}).not.toThrow(AnnotateError);
	});

	test("static methods are eagerly registered; list entries commit immediately", () => {
		const Cmd = decorate.method.list<string>();

		// biome-ignore lint/complexity/noStaticOnlyClass: test fixture requires a class with a static method
		class Cli {
			@Cmd("build")
			@Cmd("compile")
			static build(): void {}
		}

		expect(Cmd.all(Cli, "build")).toHaveLength(2);
	});

	test("derive() on a list factory shares the key and keeps list cardinality", () => {
		const Parent = decorate.method.list<string>({ name: "ListParent" });
		const Child = Parent.derive();

		expect(Parent.key).toBe(Child.key);

		class Api {
			@Child("c")
			one(): void {}

			@Parent("p")
			two(): void {}
		}

		new Api();
		const names = Parent.reader(Api)
			.methods()
			.map((m) => m.name)
			.sort();
		expect(names).toEqual(["one", "two"]);
	});

	test("has() and hasOwn() reflect list entries", () => {
		const Route = decorate.method.list<string>();

		class Base {
			@Route("/base")
			handle(): void {}
		}
		class Child extends Base {}

		new Child();
		expect(Route.has(Child, "handle")).toBe(true);
		expect(Route.hasOwn(Child, "handle")).toBe(false);
		expect(Route.hasOwn(Base, "handle")).toBe(true);
	});

	test("first() and firstOrThrow() return the first-stored value (Stage-3 inner first)", () => {
		const Route = decorate.method.list<string>();

		class Api {
			@Route("/outer")
			@Route("/inner")
			handle(): void {}
		}

		new Api();
		expect(Route.first(Api, "handle")).toBe("/inner");
		expect(Route.firstOrThrow(Api, "handle")).toBe("/inner");
	});

	test("firstOrThrow() throws MissingMetadataError on an undecorated member", () => {
		const Route = decorate.method.list<string>();
		const Other = decorate.method.list<string>();

		class Api {
			@Other("/x")
			handle(): void {}
		}

		new Api();
		expect(() => Route.firstOrThrow(Api, "handle")).toThrow(MissingMetadataError);
		expect(() => Route.firstOrThrow(Api, "handle")).toThrow(AnnotateError);
	});
});
