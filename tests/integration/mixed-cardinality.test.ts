/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test stub methods and accessors */
/** biome-ignore-all lint/suspicious/noUnusedExpressions: accessor reads are side effects under test */
import { describe, expect, it } from "bun:test";

import { Annotate } from "../../src";

// class decorators
const UniqueClassMeta = Annotate.class<string>();
const ListClassMeta = Annotate.class<string>({ cardinality: "many" });

// method decorators
const UniqueMethodMeta = Annotate.method<string>();
const ListMethodMeta = Annotate.method<string>({ cardinality: "many" });

// field decorators
const UniqueFieldMeta = Annotate.field<string>();
const ListFieldMeta = Annotate.field<string>({ cardinality: "many" });

// method interceptors — capture invocation call order
const methodInterceptCalls: string[] = [];
// Captures one entry per wrapper firing in invocation order; the per-wrapper tag
// is bound at decoration time so positional assertions prove call ordering rather
// than just full-list visibility.
const listMethodCallOrder: string[] = [];
const listMethodMetaSeen: (readonly string[])[] = [];

const UniqueMethodInterceptor = Annotate.intercept.method<string>({
	wrap: (original, ctx) =>
		function (this: object, ...args: unknown[]) {
			const metadata = ctx.get(this);
			if (metadata !== undefined) {
				methodInterceptCalls.push(metadata);
			}
			return original.call(this, ...args);
		} as typeof original,
});

// Stage-3 application order: each wrapper closes over a unique creation index.
// Decoration runs bottom-up, so the inner decorator builds wrapper #1 first,
// the outer builds wrapper #2 second. At call time the outermost (last-built,
// id=2) fires before the innermost (first-built, id=1).
let listMethodWrapperCounter = 0;
const ListMethodInterceptor = Annotate.intercept.method<string>({
	cardinality: "many",
	wrap: (original, ctx) => {
		listMethodWrapperCounter += 1;
		const wrapperId = listMethodWrapperCounter;
		return function (this: object, ...args: unknown[]) {
			listMethodCallOrder.push(`wrapper-${wrapperId}`);
			listMethodMetaSeen.push(ctx.get(this));
			return original.call(this, ...args);
		} as typeof original;
	},
});

// accessor interceptors
const accessorInterceptGetCalls: string[] = [];
const listAccessorGetOrder: string[] = [];
const listAccessorSetOrder: string[] = [];
const listAccessorGetMetaSeen: (readonly string[])[] = [];
const listAccessorSetMetaSeen: (readonly string[])[] = [];

const UniqueAccessorInterceptor = Annotate.intercept.accessor<string, [string], number>({
	get: (original, ctx) =>
		function (this: object) {
			const metadata = ctx.get(this);
			if (metadata !== undefined) {
				accessorInterceptGetCalls.push(metadata);
			}
			return original.call(this);
		},
});

// Tag each wrapper with a unique id captured at decoration time (same pattern as
// ListMethodInterceptor) so positional call-order assertions prove outermost-first.
let listAccessorGetWrapperCounter = 0;
let listAccessorSetWrapperCounter = 0;
const ListAccessorInterceptor = Annotate.intercept.accessor<string, [string], number, object, "many">({
	cardinality: "many",
	get: (original, ctx) => {
		listAccessorGetWrapperCounter += 1;
		const wrapperId = listAccessorGetWrapperCounter;
		return function (this: object) {
			listAccessorGetOrder.push(`get-wrapper-${wrapperId}`);
			listAccessorGetMetaSeen.push(ctx.get(this));
			return original.call(this);
		};
	},
	set: (original, ctx) => {
		listAccessorSetWrapperCounter += 1;
		const wrapperId = listAccessorSetWrapperCounter;
		return function (this: object, v: number) {
			listAccessorSetOrder.push(`set-wrapper-${wrapperId}`);
			listAccessorSetMetaSeen.push(ctx.get(this));
			original.call(this, v);
		};
	},
});

@ListClassMeta("list-outer")
@ListClassMeta("list-inner")
@UniqueClassMeta("unique-class")
class MixedTarget {
	@UniqueMethodMeta("method-A")
	memberA(): string {
		return "A";
	}

	@ListMethodMeta("method-B-outer")
	@ListMethodMeta("method-B-inner")
	memberB(): string {
		return "B";
	}

	@UniqueFieldMeta("field-C")
	fieldC!: string;

	@ListFieldMeta("field-D-outer")
	@ListFieldMeta("field-D-inner")
	fieldD!: string;

	@UniqueMethodInterceptor("intercept-E")
	memberE(): string {
		return "E";
	}

	@ListMethodInterceptor("intercept-F-outer")
	@ListMethodInterceptor("intercept-F-inner")
	memberF(): string {
		return "F";
	}

	@UniqueAccessorInterceptor("intercept-G")
	accessor accessorG = 0;

	@ListAccessorInterceptor("intercept-H-outer")
	@ListAccessorInterceptor("intercept-H-inner")
	accessor accessorH = 0;
}

// Instantiate to materialise instance-member metadata (field deferred flush).
const instance = new MixedTarget();

describe("mixed-cardinality integration", () => {
	describe("class reads", () => {
		it("unique class handle returns scalar metadata", () => {
			expect(UniqueClassMeta.read(MixedTarget).get()).toBe("unique-class");
		});

		it("many class handle returns array metadata", () => {
			expect(ListClassMeta.read(MixedTarget).get()).toEqual(["list-inner", "list-outer"]);
		});
	});

	describe("method reads", () => {
		it("unique method handle returns scalar metadata for member A", () => {
			const results = UniqueMethodMeta.read(MixedTarget).methods();
			expect(results).toHaveLength(1);
			expect(results[0]?.name).toBe("memberA");
			expect(results[0]?.metadata).toBe("method-A");
			expect(results[0]?.kind).toBe("method");
		});

		it("many method handle returns array metadata in Stage-3 order", () => {
			const results = ListMethodMeta.read(MixedTarget).methods();
			expect(results).toHaveLength(1);
			const entry = results[0];
			expect(entry?.name).toBe("memberB");
			expect(entry?.metadata).toEqual(["method-B-inner", "method-B-outer"]);
		});
	});

	describe("field reads", () => {
		it("unique field handle returns scalar metadata for field C", () => {
			const results = UniqueFieldMeta.read(MixedTarget).fields();
			expect(results).toHaveLength(1);
			expect(results[0]?.name).toBe("fieldC");
			expect(results[0]?.metadata).toBe("field-C");
			expect(results[0]?.kind).toBe("field");
		});

		it("many field handle returns array metadata in Stage-3 order", () => {
			const results = ListFieldMeta.read(MixedTarget).fields();
			expect(results).toHaveLength(1);
			const entry = results[0];
			expect(entry?.name).toBe("fieldD");
			expect(entry?.metadata).toEqual(["field-D-inner", "field-D-outer"]);
		});
	});

	describe("accessor interceptor reads", () => {
		it("unique accessor interceptor handle returns scalar metadata for accessor G", () => {
			const results = UniqueAccessorInterceptor.read(MixedTarget).accessors();
			const entry = results.find((accessor) => accessor.name === "accessorG");
			expect(entry).toBeDefined();
			expect(entry?.metadata).toBe("intercept-G");
		});

		it("many accessor interceptor handle returns array metadata for accessor H", () => {
			const results = ListAccessorInterceptor.read(MixedTarget).accessors();
			const entry = results.find((accessor) => accessor.name === "accessorH");
			expect(entry).toBeDefined();
			expect(Array.isArray(entry?.metadata)).toBe(true);
			expect(entry?.metadata).toHaveLength(2);
		});
	});

	describe("method interceptor reads", () => {
		it("unique method interceptor handle returns scalar metadata for member E", () => {
			const results = UniqueMethodInterceptor.read(MixedTarget).methods();
			const entry = results.find((method) => method.name === "memberE");
			expect(entry).toBeDefined();
			expect(entry?.metadata).toBe("intercept-E");
		});

		it("many method interceptor handle returns array metadata for member F", () => {
			const results = ListMethodInterceptor.read(MixedTarget).methods();
			const entry = results.find((method) => method.name === "memberF");
			expect(entry).toBeDefined();
			expect(Array.isArray(entry?.metadata)).toBe(true);
			expect(entry?.metadata).toHaveLength(2);
		});
	});

	describe("interceptor runtime behaviour", () => {
		it("unique method interceptor runs on member E invocation", () => {
			methodInterceptCalls.length = 0;
			instance.memberE();
			expect(methodInterceptCalls).toEqual(["intercept-E"]);
		});

		it("many method interceptor: outermost-first call order; ctx.get is full list in each wrapper", () => {
			listMethodCallOrder.length = 0;
			listMethodMetaSeen.length = 0;
			instance.memberF();

			expect(listMethodCallOrder).toEqual(["wrapper-2", "wrapper-1"]);
			expect(listMethodMetaSeen).toHaveLength(2);
			for (const seenMeta of listMethodMetaSeen) {
				expect(seenMeta).toEqual(["intercept-F-inner", "intercept-F-outer"]);
			}
		});

		it("unique accessor interceptor runs on accessorG get", () => {
			accessorInterceptGetCalls.length = 0;
			const _read = instance.accessorG;
			expect(accessorInterceptGetCalls).toContain("intercept-G");
		});

		it("many accessor interceptor: both getter wrappers run on accessorH get", () => {
			listAccessorGetOrder.length = 0;
			listAccessorGetMetaSeen.length = 0;
			const _read = instance.accessorH;

			expect(listAccessorGetOrder).toHaveLength(2);
			expect(listAccessorGetOrder[0]).toBe("get-wrapper-2");
			expect(listAccessorGetOrder[1]).toBe("get-wrapper-1");

			for (const seenMeta of listAccessorGetMetaSeen) {
				expect(seenMeta).toEqual(["intercept-H-inner", "intercept-H-outer"]);
			}
		});

		it("many accessor interceptor: both setter wrappers run on accessorH set", () => {
			listAccessorSetOrder.length = 0;
			listAccessorSetMetaSeen.length = 0;
			instance.accessorH = 99;

			expect(listAccessorSetOrder).toHaveLength(2);
			expect(listAccessorSetOrder[0]).toBe("set-wrapper-2");
			expect(listAccessorSetOrder[1]).toBe("set-wrapper-1");

			for (const seenMeta of listAccessorSetMetaSeen) {
				expect(seenMeta).toEqual(["intercept-H-inner", "intercept-H-outer"]);
			}
		});
	});
});
