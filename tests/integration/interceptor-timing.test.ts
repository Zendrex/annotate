import { describe, expect, test } from "bun:test";

import { createAccessorInterceptor, createMethodDecorator, createMethodInterceptor } from "../../src";

describe("interceptor decoration-order independence", () => {
	test("interceptor at the bottom observes sibling decorators applied above", () => {
		const Sibling = createMethodDecorator<string>();
		const seen: string[][] = [];
		const Bottom = createMethodInterceptor<string>({
			intercept: (original, readMetadata) =>
				function (this: unknown, ...args: unknown[]) {
					seen.push(readMetadata(this as object));
					return original.call(this, ...args);
				} as typeof original,
		});

		class X {
			@Sibling("from-sibling")
			@Bottom("from-bottom")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test fixture
			run(): void {}
		}

		const x = new X();
		x.run();
		expect(seen).toEqual([["from-bottom"]]);
		expect(Sibling.metadata(X, "run")).toBe("from-sibling");
	});

	test("stacking the same interceptor factory: composed wrapper sees both metadata", () => {
		const Trace = createMethodInterceptor<string>({
			intercept: (original, readMetadata) =>
				function (this: unknown, ...args: unknown[]) {
					(this as { _seen?: string[][] })._seen ??= [];
					(this as { _seen: string[][] })._seen.push(readMetadata(this as object));
					return original.call(this, ...args);
				} as typeof original,
		});

		class X {
			@Trace("outer")
			@Trace("inner")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test fixture
			run(): void {}
		}

		const x = new X() as X & { _seen?: string[][] };
		x.run();
		expect(x._seen).toEqual([
			["inner", "outer"],
			["inner", "outer"],
		]);
	});

	test("instance-member-only class: interceptor sees full metadata on first invocation", () => {
		const Trace = createMethodInterceptor<string>({
			intercept: (original, readMetadata) =>
				function (this: unknown, ...args: unknown[]) {
					(this as { _meta?: string[] })._meta = readMetadata(this as object);
					return original.call(this, ...args);
				} as typeof original,
		});

		class X {
			@Trace("v")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test fixture
			run(): void {}
		}

		const x = new X() as X & { _meta?: string[] };
		x.run();
		expect(x._meta).toEqual(["v"]);
	});

	test("ancestor merge: subclass interceptor reads merge ancestor metadata", () => {
		const Trace = createMethodInterceptor<string>({
			intercept: (original, readMetadata) =>
				function (this: unknown, ...args: unknown[]) {
					(this as { _meta?: string[] })._meta = readMetadata(this as object);
					return original.call(this, ...args);
				} as typeof original,
		});

		// Classes are function-scoped to work around a Bun 1.3.13 transpiler bug that
		// emits a shared `_init` per module scope: when two decorated classes live
		// in the same scope, the later class's init array overwrites the earlier one's,
		// so ancestor initializers never fire on subclass instantiation. Isolating each
		// class in its own function gives Bun distinct `_init` variables per scope.
		// See also tests/unit/reflector/reflector.test.ts:33 (same bug class).
		function makeA() {
			class A {
				@Trace("a")
				// biome-ignore lint/suspicious/noEmptyBlockStatements: test fixture
				run(): void {}
			}
			return A;
		}
		const A = makeA();

		function makeB(Parent: typeof A) {
			class B extends Parent {
				@Trace("b")
				// biome-ignore lint/suspicious/noEmptyBlockStatements: test fixture
				override run(): void {}
			}
			return B;
		}
		const B = makeB(A);

		const b = new B() as InstanceType<typeof B> & { _meta?: string[] };
		b.run();
		expect(b._meta).toEqual(["b", "a"]);
	});

	test("accessor onGet observes complete metadata on first invocation", () => {
		const Tag = createAccessorInterceptor<string>({
			onGet: (original, readMetadata) =>
				function (this: unknown) {
					(this as { _meta?: string[] })._meta = readMetadata(this as object);
					return original.call(this);
				},
		});

		class Box {
			@Tag("a")
			accessor value = "v";
		}

		const b = new Box() as Box & { _meta?: string[] };
		// biome-ignore lint/complexity/noVoid: discard accessor read to trigger onGet in test
		void b.value;
		expect(b._meta).toEqual(["a"]);
	});

	test("negative: snapshotting metadata at decoration time would yield empty array", () => {
		// Documents the failure mode the API design prevents. If a consumer wrote
		// `intercept: (original, readMetadata) => { const snap = readMetadata({} as never); ... }`
		// they would close over an empty array. The library does not expose a
		// decoration-time materialized array — only the reader. This test
		// confirms the reader at decoration time over a non-instance returns [].
		let snapshot: string[] | null = null;
		const Trace = createMethodInterceptor<string>({
			intercept: (original, readMetadata) => {
				// Misuse: call readMetadata with a synthetic object at decoration time.
				snapshot = readMetadata(Object.create(null));
				return original;
			},
		});
		class X {
			@Trace("v")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test fixture
			run(): void {}
		}
		// biome-ignore lint/complexity/noVoid: discard class reference to avoid unused-variable warning in test
		void X;
		expect(snapshot).toEqual([]);
	});
});
