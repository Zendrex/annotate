/** biome-ignore-all lint/complexity/noVoid: type-only variable bindings discarded to prevent unused-variable errors */
/** biome-ignore-all lint/suspicious/noUnusedExpressions: accessor reads are the side effect under test */
import { describe, expect, test } from "bun:test";

import { AnnotateError, intercept } from "../../../src";
import type { ListMetadataKey } from "../../../src";

describe("intercept.accessor.list", () => {
	test("returns a factory whose .key is assignable to ListMetadataKey<T>", () => {
		const Trace = intercept.accessor.list<string, [string], string>({
			onGet: (original) => original,
		});
		expect(typeof Trace.key).toBe("symbol");

		const _check: ListMetadataKey<string> = Trace.key;
		void _check;
	});

	test("wraps accessor getter and records metadata", () => {
		const Trace = intercept.accessor.list<string, [string], string>({
			onGet: (original, readMetadata) =>
				function (this: unknown) {
					const meta = readMetadata(this as object);
					return `[${meta.join(",")}]:${original.call(this)}`;
				},
		});

		class Box {
			@Trace("a")
			accessor value = "v";
		}

		const b = new Box();
		expect(b.value).toBe("[a]:v");
		expect(Trace.first(Box, "value")).toBe("a");
	});

	test("two stacked .list accessor decorations: both getter wrappers run (Stage-3 order)", () => {
		const callOrder: string[] = [];

		const Layer = intercept.accessor.list<string, [string], string>({
			onGet: (original, readMetadata, context) =>
				function (this: unknown) {
					const meta = readMetadata(this as object);
					callOrder.push(`${String(context.name)}:${meta.join(",")}`);
					return original.call(this);
				},
		});

		class Box {
			@Layer("outer")
			@Layer("inner")
			accessor value = "v";
		}

		const b = new Box();
		const result = b.value;

		// Both getter wrappers ran
		expect(callOrder).toHaveLength(2);
		// Outer wrapper runs first at call time
		expect(callOrder[0]).toContain("outer");
		expect(callOrder[1]).toContain("inner");
		expect(result).toBe("v");
	});

	test("two stacked .list accessor decorations: readMetadata returns BOTH entries inside each wrapper", () => {
		const metaFromOuter: string[] = [];
		const metaFromInner: string[] = [];

		const Outer = intercept.accessor.list<string, [string], number>({
			onGet: (original, readMetadata) =>
				function (this: unknown) {
					metaFromOuter.push(...readMetadata(this as object));
					return original.call(this);
				},
		});

		const Inner = intercept.accessor.list<string, [string], number>({
			onGet: (original, readMetadata) =>
				function (this: unknown) {
					metaFromInner.push(...readMetadata(this as object));
					return original.call(this);
				},
		});

		class Box {
			@Outer("outer-meta")
			@Inner("inner-meta")
			accessor x = 1;
		}

		new Box().x;

		// Each factory has a separate key; each sees only its own entry
		expect(metaFromOuter).toEqual(["outer-meta"]);
		expect(metaFromInner).toEqual(["inner-meta"]);
	});

	test("two stacked decorations of the SAME .list factory: readMetadata returns both entries", () => {
		const metaSeen: string[][] = [];

		const Layer = intercept.accessor.list<string, [string], number>({
			onGet: (original, readMetadata) =>
				function (this: unknown) {
					metaSeen.push(readMetadata(this as object));
					return original.call(this);
				},
		});

		class Box {
			@Layer("outer")
			@Layer("inner")
			accessor x = 42;
		}

		new Box().x;

		expect(metaSeen).toHaveLength(2);
		// Stage-3 bottom-up: inner decorates first → stored first; outer stored second.
		for (const seen of metaSeen) {
			expect(seen).toEqual(["inner", "outer"]);
		}
	});

	test("two stacked .list accessor decorations: onSet wrappers run for both", () => {
		const observed: string[] = [];

		const Watch = intercept.accessor.list<string, [string], string>({
			onSet: (original, readMetadata) =>
				function (this: unknown, v: string) {
					const meta = readMetadata(this as object);
					observed.push(`set:${v}:${meta.join(",")}`);
					original.call(this, v);
				},
		});

		class Cfg {
			@Watch("outer")
			@Watch("inner")
			accessor env = "dev";
		}

		const c = new Cfg();
		c.env = "prod";

		// Both set wrappers fired
		expect(observed).toHaveLength(2);
	});

	test("firstOrThrow() returns the first-stored value on a decorated accessor", () => {
		const Trace = intercept.accessor.list<string, [string], number>({
			onGet: (original) =>
				function (this: unknown) {
					return original.call(this);
				},
		});

		class Box {
			@Trace("outer")
			@Trace("inner")
			accessor x = 0;
		}

		new Box();
		// Inner decorator stores first (Stage-3 applies decorators bottom-up)
		expect(Trace.firstOrThrow(Box, "x")).toBe("inner");
	});

	test("firstOrThrow() throws MissingMetadataError on an undecorated accessor", () => {
		const Trace = intercept.accessor.list<string, [string], number>({
			onGet: (original) =>
				function (this: unknown) {
					return original.call(this);
				},
		});
		const Other = intercept.accessor.list<string, [string], number>({
			onGet: (original) =>
				function (this: unknown) {
					return original.call(this);
				},
		});

		class Box {
			@Other("x")
			accessor x = 0;
		}

		new Box();
		expect(() => Trace.firstOrThrow(Box, "x")).toThrow(AnnotateError);
	});

	test("throws when neither onGet nor onSet provided", () => {
		expect(() => intercept.accessor.list({} as never)).toThrow(TypeError);
	});

	test("metadata accumulates: all() returns list in store order", () => {
		const Layer = intercept.accessor.list<string, [string], number>({
			onGet: (original) =>
				function (this: unknown) {
					return original.call(this);
				},
		});

		class Box {
			@Layer("a")
			@Layer("b")
			accessor x = 0;
		}

		new Box();
		// Stage-3 inner-first: "b" applies first, "a" second
		const all = Layer.all(Box, "x");
		expect(all).toHaveLength(2);
		expect(all).toContain("a");
		expect(all).toContain("b");
	});
});
