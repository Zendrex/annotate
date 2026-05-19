import { describe, expect, test } from "bun:test";

import { intercept } from "../../../src";

describe("intercept.field", () => {
	test("replaces field initial value and records metadata", () => {
		const Default = intercept.field<string, [string], string>({
			onInit(this: object, _initial, readMetadata) {
				const [meta] = readMetadata(this);
				return meta ?? "";
			},
		});

		class Box {
			@Default("override")
			label = "fallback";
		}

		const b = new Box();
		expect(b.label).toBe("override");
		expect(Default.first(Box, "label")).toBe("override");
		expect(
			Default.reader(Box)
				.properties()
				.find((p) => p.name === "label")?.metadata
		).toBe("override");
	});

	test("onInit receives the field's current value", () => {
		const Suffix = intercept.field<string, [string], string>({
			onInit: (initial) => `${initial}-tagged`,
		});

		class User {
			@Suffix("x")
			name = "ada";
		}

		expect(new User().name).toBe("ada-tagged");
	});

	test("static field interception", () => {
		const Const = intercept.field<number, [number], number>({
			onInit: () => 42,
		});

		// biome-ignore lint/complexity/noStaticOnlyClass: test fixture requires a static field
		class Settings {
			@Const(0)
			static max = 0;
		}
		expect(Settings.max).toBe(42);
		expect(Const.first(Settings, "max")).toBe(0);
	});

	test("throws when onInit missing", () => {
		expect(() => intercept.field({} as never)).toThrow(TypeError);
	});

	// Regression: Bun 1.3 transformer emits a module-scope `var _init` per class.
	// If a field decorator returns a value-replacement initializer closure, that
	// closure is shared across every class in the module; only the latest one
	// survives. intercept.field sidesteps this by replacing from an
	// addInitializer body that reads metadata via `this.constructor`, so each
	// class sees its own onInit metadata.
	test("two classes in the same module each apply their own onInit", () => {
		const Label = intercept.field<string, [string], string>({
			onInit(this: object, _initial, readMetadata) {
				return readMetadata(this)[0] ?? "";
			},
		});

		class A {
			@Label("alpha")
			independent = "default-a";
		}
		class B {
			@Label("bravo")
			sidecar = "default-b";
		}

		const a = new A();
		const b = new B();
		expect(a.independent).toBe("alpha");
		expect(b.sidecar).toBe("bravo");
	});

	test("ancestor-merged metadata visible in onInit at construction", () => {
		const Resolve = intercept.field<string, [string], string>({
			onInit(this: object, _initial, readMetadata) {
				return readMetadata(this).join(",");
			},
		});

		class Parent {
			@Resolve("p")
			x = "";
		}
		class Child extends Parent {}

		expect(new Child().x).toBe("p");
	});

	test("derive() shares key; reused across child factory", () => {
		const Base = intercept.field<string, [string], string>({
			onInit(this: object, _initial, readMetadata) {
				return readMetadata(this).join("+");
			},
		});
		const Child = Base.derive();

		class Holder {
			@Base("outer")
			a = "";
		}
		class Sub extends Holder {
			@Child("inner")
			b = "";
		}

		const s = new Sub();
		expect(s.a).toBe("outer");
		expect(s.b).toBe("inner");
	});

	test("field-decorated member appears in reflect().properties()", () => {
		const Mark = intercept.field<string, [string], string>({
			onInit: (initial) => initial,
		});

		class Box {
			@Mark("v")
			x = "";
		}

		new Box();
		const props = Mark.reader(Box).properties();
		expect(props).toHaveLength(1);
		expect(props[0]?.name).toBe("x");
		expect(props[0]?.static).toBe(false);
	});

	test("context.kind is 'field'", () => {
		let seenKind: string | undefined;
		const Sniff = intercept.field<string, [string], string>({
			onInit(_initial, _readMetadata, ctx) {
				seenKind = ctx.kind;
				return "ok";
			},
		});

		class X {
			@Sniff("a")
			y = "";
		}

		new X();
		expect(seenKind).toBe("field");
	});
});
