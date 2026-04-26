/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
import { describe, expect, spyOn, test } from "bun:test";

import { decorate, reflect, UnregisteredClassError } from "../../../src";

describe("reflect() per-ctor caching", () => {
	test("returns the same Reflector instance for repeated calls on the same ctor", () => {
		const Tag = decorate.class<string>();

		@Tag("a")
		class A {}

		const first = reflect(A);
		const second = reflect(A);

		expect(second).toBe(first);
	});

	test("returns the same Reflector for an instance and its constructor", () => {
		const Tag = decorate.class<string>();

		@Tag("a")
		class A {}

		const instance = new A();
		const fromInstance = reflect(instance);
		const fromCtor = reflect(A);

		expect(fromInstance).toBe(fromCtor);
	});

	test("returns distinct Reflector instances for different ctors", () => {
		const Tag = decorate.class<string>();

		@Tag("a")
		class A {}
		@Tag("b")
		class B {}

		expect(reflect(A)).not.toBe(reflect(B));
	});

	test("methodLikeCache is shared: prototype mutation after first call does not affect second call result", () => {
		// Isolation: wrap in a function so Bun emits a distinct _init per scope.
		function makeC() {
			const Route = decorate.method<string>();

			class C {
				@Route("/c")
				run(): void {}
			}
			return { C, key: Route.key };
		}
		const { C, key } = makeC();

		// Populate the cache via the first reflect call.
		const firstResult = reflect(C).methods<string>(key);
		expect(firstResult).toHaveLength(1);
		expect(firstResult[0]?.name).toBe("run");

		// Mutate the prototype so a fresh introspection would classify "run" as a non-function.
		Object.defineProperty(C.prototype, "run", {
			value: "not-a-function",
			configurable: true,
			writable: true,
		});

		// Second call through the same cached ReflectorImpl must still return the method
		// (isMethod=true is stored in methodLikeCache from the first call).
		const secondResult = reflect(C).methods<string>(key);
		expect(secondResult).toHaveLength(1);
		expect(secondResult[0]?.name).toBe("run");
	});

	test("methodLikeCache is shared: Object.getOwnPropertyDescriptor is not called a second time for the same member", () => {
		function makeD() {
			const Route = decorate.method<string>();

			class D {
				@Route("/d")
				run(): void {}
			}
			return { D, key: Route.key };
		}
		const { D, key } = makeD();

		const spy = spyOn(Object, "getOwnPropertyDescriptor");
		spy.mockClear();

		// First call: fills methodLikeCache, expects at least one descriptor lookup for "run".
		reflect(D).methods<string>(key);
		const countAfterFirst = spy.mock.calls.length;

		spy.mockClear();

		// Second call through the same cached Reflector: the cache is warm, so no
		// additional descriptor lookups for this member should be needed.
		reflect(D).methods<string>(key);
		const countAfterSecond = spy.mock.calls.length;

		spy.mockRestore();

		expect(countAfterFirst).toBeGreaterThan(0);
		expect(countAfterSecond).toBe(0);
	});

	test("late decoration: cached impl retries ensureRegistered after class is decorated post-reflect", () => {
		const Tag = decorate.class<string>();

		// A truly bare class — no decorators applied at definition time.
		class Late {}

		// First reflect call must fail: no metadata registered yet.
		expect(() => reflect(Late).class(Tag.key)).toThrow(UnregisteredClassError);

		// Simulate late decoration by manually installing Symbol.metadata and invoking
		// the decorator function directly (mirrors what the Stage-3 transpiler emits).
		const METADATA_SYMBOL: symbol = Symbol.metadata ?? Symbol.for("Symbol.metadata");
		const metadataObj = Object.create(null) as object;
		Object.defineProperty(Late, METADATA_SYMBOL, {
			value: metadataObj,
			configurable: true,
			writable: true,
			enumerable: false,
		});

		// Call the inner decorator function — appendClassMeta + registerCtor + flushFor.
		Tag("late-value")(
			Late as unknown as abstract new () => unknown,
			{
				kind: "class",
				name: "Late",
				metadata: metadataObj,
				addInitializer: () => {},
			} as ClassDecoratorContext
		);

		// The cached ReflectorImpl still has registered=false (it threw last time), so
		// ensureRegistered runs again and now succeeds.
		const result = reflect(Late).class<string>(Tag.key);
		expect(result).not.toBeUndefined();
		expect(result?.metadata).toBe("late-value");
	});
});
