/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
/** biome-ignore-all lint/suspicious/noExplicitAny: unregistered key test intentionally passes an arbitrary symbol */
import { describe, expect, test } from "bun:test";

import { mintUniqueKey, reflect, UnregisteredClassError } from "../../../src";
import { registerCtor } from "../../../src/metadata/pipeline";
import { appendClassMeta, appendMemberMeta } from "../../../src/metadata/store";
import type { Ctor, MetadataKey } from "../../../src/metadata/types";

function classTag<T>(key: MetadataKey<T>, value: T) {
	return <TClass extends abstract new (...args: never[]) => unknown>(
		ctor: TClass,
		context: ClassDecoratorContext<TClass>
	): void => {
		appendClassMeta(ctor, key, value);
		registerCtor(ctor, context.metadata);
	};
}

function memberTag<T>(key: MetadataKey<T>, value: T, kind: "method" | "field" = "method") {
	return (_value: unknown, context: ClassMethodDecoratorContext | ClassFieldDecoratorContext): void => {
		context.addInitializer(function (this: unknown) {
			const ctor = context.static ? (this as Ctor) : (this as { constructor: Ctor }).constructor;
			appendMemberMeta(ctor, key, context.name, value, Symbol(kind), {
				static: context.static,
				kind,
			});
			registerCtor(ctor, context.metadata);
		});
	};
}

describe("Reflector", () => {
	test("class() returns undefined when key not applied but class has other metadata", () => {
		const key = mintUniqueKey<string>("tag");
		const other = mintUniqueKey<string>("other");

		@classTag(other, "o")
		class X {}

		expect(reflect(X).class<string>(key)).toBeUndefined();
	});

	test("methods() collects own + ancestor entries, most-derived-first", () => {
		const key = mintUniqueKey<string>("route");

		class A {
			run(): void {}
		}
		class B extends A {
			override run(): void {}
		}

		appendMemberMeta(A, key, "run", "/a", Symbol("a"), { static: false, kind: "method" });
		appendMemberMeta(B, key, "run", "/b", Symbol("b"), { static: false, kind: "method" });

		const methods = reflect(B).methods<string>(key);
		const run = methods.find((method) => method.name === "run");
		expect(run?.metadata).toBe("/b");
	});

	test("throws UnregisteredClassError when class never decorated", () => {
		class Bare {}
		expect(() => reflect(Bare).methods(Symbol("k") as any)).toThrow(UnregisteredClassError);
	});

	test("auto-materialize: properties() of an instance-member-only class works pre-instantiation", () => {
		const key = mintUniqueKey<string>("field");

		class User {
			name!: string;
		}

		appendMemberMeta(User, key, "name", "varchar", Symbol("name"), { static: false, kind: "field" });

		const props = reflect(User).properties<string>(key);
		expect(props).toHaveLength(1);
		expect(props[0]?.name).toBe("name");
	});

	test("static and instance methods coexist; static carries the static flag", () => {
		const key = mintUniqueKey<string>("cmd");

		class Cli {
			@memberTag(key, "inst")
			run(): void {}

			@memberTag(key, "st")
			static build(): void {}
		}

		new Cli();
		const methods = reflect(Cli).methods<string>(key);
		expect(methods.find((method) => method.name === "run")?.static).toBe(false);
		expect(methods.find((method) => method.name === "build")?.static).toBe(true);
	});

	test("instance field named 'name' is classified as instance, not static", () => {
		const key = mintUniqueKey<string>("field");

		class User {
			name!: string;
		}

		appendMemberMeta(User, key, "name", "v", Symbol("name"), { static: false, kind: "field" });

		const props = reflect(User).properties<string>(key);
		expect(props).toHaveLength(1);
		expect(props[0]?.static).toBe(false);
	});
});
