/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
import { describe, expect, test } from "bun:test";

import { mintUniqueKey, reflect, UnregisteredClassError } from "../../../src";
import { registerCtor } from "../../../src/metadata/pipeline/ctor-correlation";
import { appendClassMeta } from "../../../src/metadata/stores/class-meta-store";
import { appendMemberMeta } from "../../../src/metadata/stores/member-meta-store";
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

function methodTag<T>(key: MetadataKey<T>, value: T) {
	return (_method: unknown, context: ClassMethodDecoratorContext): void => {
		context.addInitializer(function (this: unknown) {
			const ctor = context.static ? (this as Ctor) : (this as { constructor: Ctor }).constructor;
			appendMemberMeta(ctor, key, context.name, value, Symbol("method"), {
				static: context.static,
				kind: "method",
			});
			registerCtor(ctor, context.metadata);
		});
	};
}

describe("reflect() per-ctor caching", () => {
	test("returns the same Reflector instance for repeated calls on the same ctor", () => {
		class A {}

		const first = reflect(A);
		const second = reflect(A);

		expect(second).toBe(first);
	});

	test("returns the same Reflector for an instance and its constructor", () => {
		class A {}

		const instance = new A();
		const fromInstance = reflect(instance);
		const fromCtor = reflect(A);

		expect(fromInstance).toBe(fromCtor);
	});

	test("returns distinct Reflector instances for different ctors", () => {
		class A {}
		class B {}

		expect(reflect(A)).not.toBe(reflect(B));
	});

	test("methodLikeCache is shared: prototype mutation after first call does not affect second call result", () => {
		function makeC() {
			const key = mintUniqueKey<string>("route");

			class C {
				@methodTag(key, "/c")
				run(): void {}
			}
			new C();
			return { C, key };
		}
		const { C, key } = makeC();

		const firstResult = reflect(C).methods<string>(key);
		expect(firstResult).toHaveLength(1);
		expect(firstResult[0]?.name).toBe("run");

		Object.defineProperty(C.prototype, "run", {
			value: "not-a-function",
			configurable: true,
			writable: true,
		});

		const secondResult = reflect(C).methods<string>(key);
		expect(secondResult).toHaveLength(1);
		expect(secondResult[0]?.name).toBe("run");
	});

	test("late decoration: cached impl retries ensureRegistered after class is decorated post-reflect", () => {
		const key = mintUniqueKey<string>("tag");

		class Late {}

		expect(() => reflect(Late).class(key)).toThrow(UnregisteredClassError);

		const metadataObj = Object.create(null) as object;
		classTag(key, "late-value")(
			Late as unknown as abstract new () => unknown,
			{
				kind: "class",
				name: "Late",
				metadata: metadataObj,
				addInitializer: () => {},
			} as ClassDecoratorContext
		);

		const result = reflect(Late).class<string>(key);
		expect(result).not.toBeUndefined();
		expect(result?.metadata).toBe("late-value");
	});
});
