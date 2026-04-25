/** biome-ignore-all lint/complexity/noVoid: discard class references in tests */
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: stub methods and bases */
import { describe, expect, test } from "bun:test";

import { DuplicateMetadataError, decorate, InvalidDecorationTargetError } from "../../../src";

class BaseListener {}
class OtherBase {}

describe("Factory.derive() — shared-key semantics", () => {
	test("parent's reader(...) sees entries committed via derive() child", () => {
		const Parent = decorate.method<string>({ name: "Parent" });
		const Child = Parent.derive();

		class Api {
			@Child("a")
			one(): void {}

			@Parent("b")
			two(): void {}
		}

		new Api();
		const entries = Parent.reader(Api).methods();
		const names = entries.map((entry) => entry.name).sort();
		expect(names).toEqual(["one", "two"]);
	});

	test("parent and derive() child share the same metadata key", () => {
		const Parent = decorate.class<string>({ name: "P" });
		const Child = Parent.derive();
		expect(Parent.key).toBe(Child.key);
	});
});

describe("Factory.derive() — chained validators", () => {
	test("parent validator runs before child validator on commit", () => {
		const order: string[] = [];
		const Parent = decorate.class<string>({
			name: "Parent",
			validate: () => {
				order.push("parent");
			},
		});
		const Child = Parent.derive({
			validate: () => {
				order.push("child");
			},
		});

		@Child("v")
		class Service {}
		void Service;

		expect(order).toEqual(["parent", "child"]);
	});

	test("parent throw aborts before child runs", () => {
		const order: string[] = [];
		const Parent = decorate.class<string>({
			name: "Parent",
			validate: () => {
				order.push("parent");
				throw new Error("parent-stop");
			},
		});
		const Child = Parent.derive({
			validate: () => {
				order.push("child");
			},
		});

		let caught: unknown;
		try {
			@Child("v")
			class _Service {}
			void _Service;
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(Error);
		expect(order).toEqual(["parent"]);
	});
});

describe("Factory.derive() — requireInstanceOf propagation", () => {
	test("child's requireInstanceOf fires at runtime for unrelated target", () => {
		const Parent = decorate.method<string>({ name: "Parent" });
		const Child = Parent.derive({
			requireInstanceOf: BaseListener,
		});

		class Wrong extends OtherBase {
			@Child("oops")
			handle(): void {}
		}

		let caught: unknown;
		try {
			new Wrong();
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(InvalidDecorationTargetError);
		expect((caught as InvalidDecorationTargetError).requiredBase).toBe(BaseListener);
	});

	test("child's requireInstanceOf replaces parent's (single IoF in chain)", () => {
		const Parent = decorate.class<string>({
			name: "Parent",
			requireInstanceOf: OtherBase,
		});
		const Child = Parent.derive<BaseListener>({
			requireInstanceOf: BaseListener,
		});

		let caught: unknown;
		try {
			@Child("v")
			class _Wrong extends OtherBase {}
			void _Wrong;
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(InvalidDecorationTargetError);
		expect((caught as InvalidDecorationTargetError).requiredBase).toBe(BaseListener);
	});
});

describe("Factory.derive() — unique across shared key", () => {
	test("class factory child on same class throws DuplicateMetadataError (all keys are unique)", () => {
		const Parent = decorate.class<string>({ name: "Parent" });
		const Child = Parent.derive();

		let caught: unknown;
		try {
			@Parent("a")
			@Child("b")
			class _Service {}
			void _Service;
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(DuplicateMetadataError);
	});

	test("static method child on same member throws at decoration time (all keys are unique)", () => {
		const Parent = decorate.method<string>({ name: "Parent" });
		const Child = Parent.derive();

		let caught: unknown;
		try {
			// biome-ignore lint/complexity/noStaticOnlyClass: decorators require a class host for the static method
			class _Svc {
				@Parent("a")
				@Child("b")
				static run(): void {}
			}
			void _Svc;
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(DuplicateMetadataError);
	});
});

describe("Factory.derive() — compile-time locks (compile-only)", () => {
	test("Pick rejects compose", () => {
		const Parent = decorate.class<string>({ name: "Parent" });

		// @ts-expect-error — compose is omitted from the derive() Pick signature.
		Parent.derive({ compose: (x: string) => x });
	});
});
