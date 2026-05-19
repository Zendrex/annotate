/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test stub methods and accessors */
/** biome-ignore-all lint/suspicious/noUnusedExpressions: accessor reads are side effects under test */
import { describe, expect, it } from "bun:test";

import { reflect } from "../../src";
import { createAccessorInterceptor, createAccessorListInterceptor } from "../../src/factories/accessor-interceptor";
import { createClassDecorator, createClassListDecorator } from "../../src/factories/class-decorator";
import { createMethodDecorator, createMethodListDecorator } from "../../src/factories/method-decorator";
import { createMethodInterceptor, createMethodListInterceptor } from "../../src/factories/method-interceptor";
import { createPropertyDecorator, createPropertyListDecorator } from "../../src/factories/property-decorator";

// ── Factories ─────────────────────────────────────────────────────────────────

// class decorators
const UniqueClassMeta = createClassDecorator<string>();
const ListClassMeta = createClassListDecorator<string>();

// method decorators
const UniqueMethodMeta = createMethodDecorator<string>();
const ListMethodMeta = createMethodListDecorator<string>();

// property decorators
const UniquePropertyMeta = createPropertyDecorator<string>();
const ListPropertyMeta = createPropertyListDecorator<string>();

// method interceptors — capture invocation call order
const methodInterceptCalls: string[] = [];
// Captures one entry per wrapper firing in invocation order; the per-wrapper tag
// is bound at decoration time so positional assertions prove call ordering rather
// than just full-list visibility.
const listMethodCallOrder: string[] = [];
const listMethodMetaSeen: string[][] = [];

const UniqueMethodInterceptor = createMethodInterceptor<string>({
	intercept: (original, readMetadata) =>
		function (this: unknown, ...args: unknown[]) {
			methodInterceptCalls.push(...readMetadata(this as object));
			return original.call(this, ...args);
		} as typeof original,
});

// Stage-3 application order: each wrapper closes over a unique creation index.
// Decoration runs bottom-up, so the inner decorator builds wrapper #1 first,
// the outer builds wrapper #2 second. At call time the outermost (last-built,
// id=2) fires before the innermost (first-built, id=1).
let listMethodWrapperCounter = 0;
const ListMethodInterceptor = createMethodListInterceptor<string>({
	intercept: (original, readMetadata) => {
		listMethodWrapperCounter += 1;
		const wrapperId = listMethodWrapperCounter;
		return function (this: unknown, ...args: unknown[]) {
			listMethodCallOrder.push(`wrapper-${wrapperId}`);
			listMethodMetaSeen.push(readMetadata(this as object));
			return original.call(this, ...args);
		} as typeof original;
	},
});

// accessor interceptors
const accessorInterceptGetCalls: string[] = [];
const listAccessorGetOrder: string[] = [];
const listAccessorSetOrder: string[] = [];
const listAccessorGetMetaSeen: string[][] = [];
const listAccessorSetMetaSeen: string[][] = [];

const UniqueAccessorInterceptor = createAccessorInterceptor<string, [string], number>({
	onGet: (original, readMetadata) =>
		function (this: unknown) {
			accessorInterceptGetCalls.push(...readMetadata(this as object));
			return original.call(this);
		},
});

// Tag each wrapper with a unique id captured at decoration time (same pattern as
// ListMethodInterceptor) so positional call-order assertions prove outermost-first.
let listAccessorGetWrapperCounter = 0;
let listAccessorSetWrapperCounter = 0;
const ListAccessorInterceptor = createAccessorListInterceptor<string, [string], number>({
	onGet: (original, readMetadata) => {
		listAccessorGetWrapperCounter += 1;
		const wrapperId = listAccessorGetWrapperCounter;
		return function (this: unknown) {
			listAccessorGetOrder.push(`get-wrapper-${wrapperId}`);
			listAccessorGetMetaSeen.push(readMetadata(this as object));
			return original.call(this);
		};
	},
	onSet: (original, readMetadata) => {
		listAccessorSetWrapperCounter += 1;
		const wrapperId = listAccessorSetWrapperCounter;
		return function (this: unknown, v: number) {
			listAccessorSetOrder.push(`set-wrapper-${wrapperId}`);
			listAccessorSetMetaSeen.push(readMetadata(this as object));
			original.call(this, v);
		};
	},
});

// ── Fixture class ─────────────────────────────────────────────────────────────

@ListClassMeta("list-outer")
@ListClassMeta("list-inner")
@UniqueClassMeta("unique-class")
class MixedTarget {
	// A: unique method meta
	@UniqueMethodMeta("method-A")
	memberA(): string {
		return "A";
	}

	// B: list method meta — two stacked
	@ListMethodMeta("method-B-outer")
	@ListMethodMeta("method-B-inner")
	memberB(): string {
		return "B";
	}

	// C: unique property
	@UniquePropertyMeta("property-C")
	fieldC!: string;

	// D: list property — two stacked
	@ListPropertyMeta("property-D-outer")
	@ListPropertyMeta("property-D-inner")
	fieldD!: string;

	// E: unique method interceptor
	@UniqueMethodInterceptor("intercept-E")
	memberE(): string {
		return "E";
	}

	// F: list method interceptor — two stacked
	@ListMethodInterceptor("intercept-F-outer")
	@ListMethodInterceptor("intercept-F-inner")
	memberF(): string {
		return "F";
	}

	// G: unique accessor interceptor
	@UniqueAccessorInterceptor("intercept-G")
	accessor accessorG = 0;

	// H: list accessor interceptor — two stacked
	@ListAccessorInterceptor("intercept-H-outer")
	@ListAccessorInterceptor("intercept-H-inner")
	accessor accessorH = 0;
}

// Instantiate to materialise instance-member metadata (property deferred flush).
const instance = new MixedTarget();

const r = reflect(MixedTarget);

// ── Describe ──────────────────────────────────────────────────────────────────

describe("mixed-cardinality integration", () => {
	describe("r.class() — class meta shapes", () => {
		it("unique class key returns scalar metadata", () => {
			const result = r.class(UniqueClassMeta.key);
			expect(result).toBeDefined();
			expect(result?.metadata).toBe("unique-class");
		});

		it("list class key returns array metadata", () => {
			const result = r.class(ListClassMeta.key);
			expect(result).toBeDefined();
			expect(Array.isArray(result?.metadata)).toBe(true);
			// Stage-3: decorators apply bottom-up — inner runs first, outer second
			expect(result?.metadata).toEqual(["list-inner", "list-outer"]);
		});
	});

	describe("r.methods() — method meta shapes", () => {
		it("unique method key returns DecoratedMethodUnique for member A", () => {
			const results = r.methods(UniqueMethodMeta.key);
			expect(results).toHaveLength(1);
			expect(results[0]?.name).toBe("memberA");
			expect(results[0]?.metadata).toBe("method-A");
			expect(results[0]?.kind).toBe("method");
		});

		it("list method key: member B, array metadata in Stage-3 order (inner first)", () => {
			const results = r.methods(ListMethodMeta.key);
			expect(results).toHaveLength(1);
			const entry = results[0];
			expect(entry?.name).toBe("memberB");
			expect(entry?.metadata).toEqual(["method-B-inner", "method-B-outer"]);
		});
	});

	describe("r.properties() — property meta shapes", () => {
		it("unique property key returns DecoratedPropertyUnique for field C", () => {
			const results = r.properties(UniquePropertyMeta.key);
			expect(results).toHaveLength(1);
			expect(results[0]?.name).toBe("fieldC");
			expect(results[0]?.metadata).toBe("property-C");
			expect(results[0]?.kind).toBe("property");
		});

		it("list property key: field D, array metadata in Stage-3 order (inner first)", () => {
			const results = r.properties(ListPropertyMeta.key);
			expect(results).toHaveLength(1);
			const entry = results[0];
			expect(entry?.name).toBe("fieldD");
			expect(entry?.metadata).toEqual(["property-D-inner", "property-D-outer"]);
		});
	});

	describe("r.properties() — interceptor accessor shapes", () => {
		it("unique accessor interceptor key returns scalar property meta for accessor G", () => {
			const results = r.properties(UniqueAccessorInterceptor.key);
			const entry = results.find((p) => p.name === "accessorG");
			expect(entry).toBeDefined();
			expect(entry?.metadata).toBe("intercept-G");
		});

		it("list accessor interceptor key returns array property meta for accessor H", () => {
			const results = r.properties(ListAccessorInterceptor.key);
			const entry = results.find((p) => p.name === "accessorH");
			expect(entry).toBeDefined();
			expect(Array.isArray(entry?.metadata)).toBe(true);
			expect(entry?.metadata).toHaveLength(2);
		});
	});

	describe("r.methods() — interceptor method shapes", () => {
		it("unique method interceptor key returns scalar method meta for member E", () => {
			const results = r.methods(UniqueMethodInterceptor.key);
			const entry = results.find((m) => m.name === "memberE");
			expect(entry).toBeDefined();
			expect(entry?.metadata).toBe("intercept-E");
		});

		it("list method interceptor key returns array method meta for member F", () => {
			const results = r.methods(ListMethodInterceptor.key);
			const entry = results.find((m) => m.name === "memberF");
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

		it("list method interceptor: outermost-first call order; readMetadata is full list in each wrapper", () => {
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

		it("list accessor interceptor: both getter wrappers run on accessorH get (outermost first)", () => {
			listAccessorGetOrder.length = 0;
			listAccessorGetMetaSeen.length = 0;
			const _read = instance.accessorH;

			expect(listAccessorGetOrder).toHaveLength(2);
			// Stage-3: inner decorates first → wrapper #1; outer decorates second → wrapper #2.
			// Outermost (id=2) fires first at call time.
			expect(listAccessorGetOrder[0]).toBe("get-wrapper-2");
			expect(listAccessorGetOrder[1]).toBe("get-wrapper-1");

			// Each wrapper sees the full list
			for (const seenMeta of listAccessorGetMetaSeen) {
				expect(seenMeta).toHaveLength(2);
				expect(seenMeta).toContain("intercept-H-inner");
				expect(seenMeta).toContain("intercept-H-outer");
			}
		});

		it("list accessor interceptor: both setter wrappers run on accessorH set (outermost first)", () => {
			listAccessorSetOrder.length = 0;
			listAccessorSetMetaSeen.length = 0;
			instance.accessorH = 99;

			expect(listAccessorSetOrder).toHaveLength(2);
			// Same Stage-3 ordering rule for setter wrappers.
			expect(listAccessorSetOrder[0]).toBe("set-wrapper-2");
			expect(listAccessorSetOrder[1]).toBe("set-wrapper-1");

			for (const seenMeta of listAccessorSetMetaSeen) {
				expect(seenMeta).toHaveLength(2);
			}
		});
	});
});
