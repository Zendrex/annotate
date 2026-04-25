/**
 * Integration test: one class with mixed unique + list decorators read through a
 * single `Reflector`. Exercises every decorator and interceptor factory kind,
 * then asserts the shape contracts of `Reflector` and `createScopedReflector`.
 */
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test stub methods and accessors */
/** biome-ignore-all lint/suspicious/noUnusedExpressions: accessor reads are side effects under test */
import { describe, expect, it } from "bun:test";

import { decorate, intercept, reflect } from "../../src";
import { createScopedReflector } from "../../src/reflector/scoped-reflector";

// ── Factories ─────────────────────────────────────────────────────────────────

// class decorators
const UniqueClassMeta = decorate.class<string>();
const ListClassMeta = decorate.class.list<string>();

// method decorators
const UniqueMethodMeta = decorate.method<string>();
const ListMethodMeta = decorate.method.list<string>();

// property decorators
const UniquePropertyMeta = decorate.property<string>();
const ListPropertyMeta = decorate.property.list<string>();

// method interceptors — capture invocation call order
const methodInterceptCalls: string[] = [];
const listMethodInterceptCalls: string[][] = [];

const UniqueMethodInterceptor = intercept.method<string>({
	intercept: (original, readMetadata) =>
		function (this: unknown, ...args: unknown[]) {
			methodInterceptCalls.push(...readMetadata(this as object));
			return original.call(this, ...args);
		} as typeof original,
});

const ListMethodInterceptor = intercept.method.list<string>({
	intercept: (original, readMetadata) =>
		function (this: unknown, ...args: unknown[]) {
			listMethodInterceptCalls.push(readMetadata(this as object));
			return original.call(this, ...args);
		} as typeof original,
});

// accessor interceptors
const accessorInterceptGetCalls: string[] = [];
const listAccessorGetCalls: string[][] = [];
const listAccessorSetCalls: string[][] = [];

const UniqueAccessorInterceptor = intercept.accessor<string, [string], number>({
	onGet: (original, readMetadata) =>
		function (this: unknown) {
			accessorInterceptGetCalls.push(...readMetadata(this as object));
			return original.call(this);
		},
});

const ListAccessorInterceptor = intercept.accessor.list<string, [string], number>({
	onGet: (original, readMetadata) =>
		function (this: unknown) {
			listAccessorGetCalls.push(readMetadata(this as object));
			return original.call(this);
		},
	onSet: (original, readMetadata) =>
		function (this: unknown, v: number) {
			listAccessorSetCalls.push(readMetadata(this as object));
			original.call(this, v);
		},
});

// ── Fixture class ─────────────────────────────────────────────────────────────

/**
 * One class that uses ALL decorator / interceptor factory kinds on distinct members.
 *
 * Members:
 *   A — unique method meta (@UniqueMethodMeta)
 *   B — list method meta   (@ListMethodMeta ×2 — two stacked)
 *   C — unique property meta
 *   D — list property meta ×2
 *   E — unique method interceptor
 *   F — list method interceptor ×2
 *   G — unique accessor interceptor
 *   H — list accessor interceptor ×2
 */
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

		it("list class key metadata has length 2", () => {
			const result = r.class(ListClassMeta.key);
			expect(result?.metadata).toHaveLength(2);
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

		it("unique method key does NOT include member B", () => {
			const results = r.methods(UniqueMethodMeta.key);
			const names = results.map((m) => m.name);
			expect(names).not.toContain("memberB");
		});

		it("list method key returns DecoratedMethodList for member B with length 2", () => {
			const results = r.methods(ListMethodMeta.key);
			expect(results).toHaveLength(1);
			const entry = results[0];
			expect(entry?.name).toBe("memberB");
			expect(Array.isArray(entry?.metadata)).toBe(true);
			expect(entry?.metadata).toHaveLength(2);
			expect(entry?.metadata).toContain("method-B-outer");
			expect(entry?.metadata).toContain("method-B-inner");
		});

		it("list method key does NOT include member A", () => {
			const results = r.methods(ListMethodMeta.key);
			const names = results.map((m) => m.name);
			expect(names).not.toContain("memberA");
		});

		it("list method metadata is in Stage-3 application order (inner first)", () => {
			const results = r.methods(ListMethodMeta.key);
			const meta = results[0]?.metadata as readonly string[];
			expect(meta[0]).toBe("method-B-inner");
			expect(meta[1]).toBe("method-B-outer");
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

		it("unique property key does NOT include field D", () => {
			const results = r.properties(UniquePropertyMeta.key);
			const names = results.map((p) => p.name);
			expect(names).not.toContain("fieldD");
		});

		it("list property key returns DecoratedPropertyList for field D with length 2", () => {
			const results = r.properties(ListPropertyMeta.key);
			expect(results).toHaveLength(1);
			const entry = results[0];
			expect(entry?.name).toBe("fieldD");
			expect(Array.isArray(entry?.metadata)).toBe(true);
			expect(entry?.metadata).toHaveLength(2);
			expect(entry?.metadata).toContain("property-D-outer");
			expect(entry?.metadata).toContain("property-D-inner");
		});

		it("list property metadata is in Stage-3 application order (inner first)", () => {
			const results = r.properties(ListPropertyMeta.key);
			const meta = results[0]?.metadata as readonly string[];
			expect(meta[0]).toBe("property-D-inner");
			expect(meta[1]).toBe("property-D-outer");
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

	describe("r.all() — brand-driven shape contract", () => {
		it("unique method key all() returns items with scalar metadata", () => {
			const items = r.all(UniqueMethodMeta.key);
			for (const item of items) {
				expect(typeof item.metadata).toBe("string");
				expect(Array.isArray(item.metadata)).toBe(false);
			}
		});

		it("list method key all() returns items with array metadata", () => {
			const items = r.all(ListMethodMeta.key);
			for (const item of items) {
				expect(Array.isArray(item.metadata)).toBe(true);
			}
		});

		it("unique class key all() includes class entry with scalar metadata", () => {
			const items = r.all(UniqueClassMeta.key);
			const classEntry = items.find((i) => i.kind === "class");
			expect(classEntry).toBeDefined();
			expect(classEntry?.metadata).toBe("unique-class");
		});

		it("list class key all() includes class entry with array metadata", () => {
			const items = r.all(ListClassMeta.key);
			const classEntry = items.find((i) => i.kind === "class");
			expect(classEntry).toBeDefined();
			expect(Array.isArray(classEntry?.metadata)).toBe(true);
		});
	});

	describe("interceptor runtime behaviour", () => {
		it("unique method interceptor runs on member E invocation", () => {
			methodInterceptCalls.length = 0;
			instance.memberE();
			expect(methodInterceptCalls).toEqual(["intercept-E"]);
		});

		it("list method interceptor: both wrappers run on member F invocation (outermost first)", () => {
			listMethodInterceptCalls.length = 0;
			instance.memberF();
			// Two wrappers ran
			expect(listMethodInterceptCalls).toHaveLength(2);
			// Outer wrapper fires first at call time (Stage-3 application order: inner wraps first → outermost runs first)
			const firstBatch = listMethodInterceptCalls[0];
			const secondBatch = listMethodInterceptCalls[1];
			// Both wrappers share the same key; readMetadata returns the full list
			expect(firstBatch).toEqual(["intercept-F-inner", "intercept-F-outer"]);
			expect(secondBatch).toEqual(["intercept-F-inner", "intercept-F-outer"]);
		});

		it("list method interceptor: readMetadata inside each wrapper returns full list of length 2", () => {
			listMethodInterceptCalls.length = 0;
			instance.memberF();
			for (const seenMeta of listMethodInterceptCalls) {
				expect(seenMeta).toHaveLength(2);
				expect(seenMeta).toContain("intercept-F-inner");
				expect(seenMeta).toContain("intercept-F-outer");
			}
		});

		it("unique accessor interceptor runs on accessorG get", () => {
			accessorInterceptGetCalls.length = 0;
			const _read = instance.accessorG;
			expect(accessorInterceptGetCalls).toContain("intercept-G");
		});

		it("list accessor interceptor: both getter wrappers run on accessorH get", () => {
			listAccessorGetCalls.length = 0;
			const _read = instance.accessorH;
			expect(listAccessorGetCalls).toHaveLength(2);
			// Both see full list
			for (const seenMeta of listAccessorGetCalls) {
				expect(seenMeta).toHaveLength(2);
				expect(seenMeta).toContain("intercept-H-inner");
				expect(seenMeta).toContain("intercept-H-outer");
			}
		});

		it("list accessor interceptor: both setter wrappers run on accessorH set", () => {
			listAccessorSetCalls.length = 0;
			instance.accessorH = 99;
			expect(listAccessorSetCalls).toHaveLength(2);
			for (const seenMeta of listAccessorSetCalls) {
				expect(seenMeta).toHaveLength(2);
			}
		});
	});

	describe("createScopedReflector — runtime shape contracts", () => {
		// biome-ignore lint/complexity/noBannedTypes: needed for constructor type
		const ctor = MixedTarget as Function & { prototype: object };

		it("unique method key scoped reflector methods() returns scalar entries", () => {
			const scoped = createScopedReflector(ctor, UniqueMethodMeta.key);
			const methods = scoped.methods();
			for (const m of methods) {
				expect(Array.isArray(m.metadata)).toBe(false);
			}
		});

		it("list method key scoped reflector methods() returns array entries", () => {
			const scoped = createScopedReflector(ctor, ListMethodMeta.key);
			const methods = scoped.methods();
			for (const m of methods) {
				expect(Array.isArray(m.metadata)).toBe(true);
			}
		});

		it("unique class key scoped reflector class() returns scalar class entry", () => {
			const scoped = createScopedReflector(ctor, UniqueClassMeta.key);
			const entry = scoped.class();
			expect(entry).toBeDefined();
			expect(entry?.metadata).toBe("unique-class");
		});

		it("list class key scoped reflector class() returns array class entry", () => {
			const scoped = createScopedReflector(ctor, ListClassMeta.key);
			const entry = scoped.class();
			expect(entry).toBeDefined();
			expect(Array.isArray(entry?.metadata)).toBe(true);
		});
	});
});
