/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
import { describe, expect, test } from "bun:test";

import { mintListKey, mintUniqueKey } from "../../../src";
import { appendClassMeta, appendMemberMeta } from "../../../src/metadata/store";
import { createScopedReflector } from "../../../src/reflector/scoped-reflector";
import type { Ctor, MetadataKey } from "../../../src/metadata/types";

function classTag<T>(key: MetadataKey<T>, value: T) {
	return <TClass extends abstract new (...args: never[]) => unknown>(
		ctor: TClass,
		_context: ClassDecoratorContext<TClass>
	): void => {
		appendClassMeta(ctor, key, value);
	};
}

function staticMethodTag<T>(key: MetadataKey<T>, value: T) {
	return (_method: unknown, context: ClassMethodDecoratorContext): void => {
		context.addInitializer(function (this: unknown) {
			appendMemberMeta(this as Ctor, key, context.name, value, Symbol("method"), {
				static: true,
				kind: "method",
			});
		});
	};
}

function staticFieldTag<T>(key: MetadataKey<T>, value: T) {
	return (_value: unknown, context: ClassFieldDecoratorContext): void => {
		context.addInitializer(function (this: unknown) {
			appendMemberMeta(this as Ctor, key, context.name, value, Symbol("field"), {
				static: true,
				kind: "field",
			});
		});
	};
}

describe("createScopedReflector", () => {
	test("class() is scoped to the provided key", () => {
		const key = mintUniqueKey<string>("scoped");

		@classTag(key, "scoped")
		class Target {}

		const scoped = createScopedReflector(Target, key);
		const one = scoped.class();

		expect(one?.metadata).toBe("scoped");
	});

	test("methods() and all() use the scoped key", () => {
		const key = mintUniqueKey<string>("route");

		class Target {
			@staticMethodTag(key, "/a")
			static methodA(): void {}

			@staticMethodTag(key, "/b")
			static methodB(): void {}

			instance(): void {}
		}

		const scoped = createScopedReflector(Target, key);
		const methods = scoped.methods();
		const readAll = scoped.all.bind(scoped);
		expect(methods).toHaveLength(2);
		expect(readAll().length).toBeGreaterThanOrEqual(2);
	});

	test("properties() uses the scoped key", () => {
		const key = mintUniqueKey<string>("column");

		class Target {
			@staticFieldTag(key, "text")
			static field = "";

			instance(): void {}
		}

		const scoped = createScopedReflector(Target, key);
		const results = scoped.properties();

		expect(results).toHaveLength(1);
		expect(results[0]?.name).toBe("field");
	});

	test("list key class() returns array metadata", () => {
		const key = mintListKey<string>("tags");

		@classTag(key, "a")
		@classTag(key, "b")
		class MyClass {}

		const entry = createScopedReflector(MyClass, key).class();
		expect(Array.isArray(entry?.metadata)).toBe(true);
		expect(entry?.metadata).toContain("a");
		expect(entry?.metadata).toContain("b");
	});
});
