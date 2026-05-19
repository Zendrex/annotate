import { describe, expect, test } from "bun:test";

import { AnnotateError, MissingMetadataError, UnregisteredClassError } from "../../../src";
import { decorate } from "../../../src/legacy";

describe("decorate.method", () => {
	test("stores metadata on instance method after construction", () => {
		const Route = decorate.method<string>();

		class Api {
			@Route("/ping")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			ping(): void {}
		}

		new Api();
		expect(Route.first(Api, "ping")).toBe("/ping");
		expect(Route.hasOwn(Api, "ping")).toBe(true);
		expect(
			Route.reader(Api)
				.methods()
				.find((m) => m.name === "ping")?.metadata
		).toBe("/ping");
	});

	test("static methods are eagerly registered (no instantiation needed)", () => {
		const Cmd = decorate.method<string>();

		// biome-ignore lint/complexity/noStaticOnlyClass: test fixture requires a class with a single static method
		class Cli {
			@Cmd("build")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			static build(): void {}
		}

		expect(Cmd.first(Cli, "build")).toBe("build");
		expect(Cmd.hasOwn(Cli, "build")).toBe(true);
	});

	test("inheritance: child sees parent metadata via has(), not hasOwn()", () => {
		const Route = decorate.method<string>();

		class Base {
			@Route("/parent")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			handle(): void {}
		}
		class Child extends Base {}

		new Child();
		expect(Route.has(Child, "handle")).toBe(true);
		expect(Route.hasOwn(Child, "handle")).toBe(false);
		expect(Route.hasOwn(Base, "handle")).toBe(true);
	});

	test("throws DuplicateMetadataError on second application (all factory keys are unique)", () => {
		const Cmd = decorate.method<string>({ name: "Cmd" });

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

	test("first() throws UnregisteredClassError when class never decorated", () => {
		const Route = decorate.method<string>({ name: "Route" });
		class X {}
		expect(() => Route.first(X, "anything")).toThrow(UnregisteredClassError);
	});

	test("firstOrThrow throws MissingMetadataError when class registered but member not decorated", () => {
		const Route = decorate.method<string>({ name: "Route" });
		const Other = decorate.method<string>({ name: "Other" });

		class X {
			@Other("o")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			elsewhere(): void {}
		}

		new X();
		expect(() => Route.firstOrThrow(X, "absent")).toThrow(MissingMetadataError);
		expect(() => Route.firstOrThrow(X, "absent")).toThrow(AnnotateError);
		expect(() => Route.firstOrThrow(X, "absent")).not.toThrow(UnregisteredClassError);
	});
});
