/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: compile-only test file */
/** biome-ignore-all lint/complexity/noVoid: discard references to avoid unused-variable warnings */
import { describe, test } from "bun:test";

import { decorate, intercept } from "../../../src";
import type { ArgsOf, MetadataOf, ThisOf } from "../../../src";

// --- Type equality helpers (MetadataOf / ArgsOf / ThisOf) -------------------
//
// `Equal` is invariant: it returns `true` only if `A` and `B` have identical
// assignability in both directions. `Expect<true>` forces a compile error when
// a helper resolves to the wrong type, which is how these compile-only tests
// fail if the factory generic slots are reordered.

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

interface Meta {
	v: string;
}

interface OtherMeta {
	kind: "other";
}

interface Args {
	count: number;
	tag: string;
}

class BaseInstance {
	name = "";
}

const MyClassFactory = decorate.class<Meta, [Meta], BaseInstance>();
const MyCtorlessFactory = decorate.class<Meta>();
const MyClassCompose = decorate.class<Meta, [string, number], BaseInstance>({
	compose: (tag, count) => ({ v: `${tag}:${count}` }),
});

const MyMethodFactory = decorate.method<Meta, [Meta], () => void, BaseInstance>();
const UnconstrainedMethodFactory = decorate.method<Meta>();
const ScopedMethodFactory = decorate.method<Meta, [Meta], () => void, BaseInstance>();
const MyMethodCompose = decorate.method<OtherMeta, [Args], () => void>({
	compose: (a) => ({ kind: "other", ...a }),
});

const MyPropertyFactory = decorate.property<Meta, [Meta], number, BaseInstance>();
const UnconstrainedPropertyFactory = decorate.property<Meta>();
const MyPropertyCompose = decorate.property<OtherMeta, [Args], unknown>({
	compose: (a) => ({ kind: "other", ...a }),
});

const MyAccessorFactory = intercept.accessor<Meta, [Meta], number, BaseInstance>({
	onGet: (original) => original,
});
const UnconstrainedAccessorFactory = intercept.accessor<Meta, [Meta], number>({
	onGet: (original) => original,
});
const MyAccessorCompose = intercept.accessor<OtherMeta, [Args], number>({
	compose: (a) => ({ kind: "other", ...a }),
	onGet: (original) => original,
});

type _MetaClass = Expect<Equal<MetadataOf<typeof MyClassFactory>, Meta>>;
type _MetaMethod = Expect<Equal<MetadataOf<typeof MyMethodFactory>, Meta>>;
type _MetaProperty = Expect<Equal<MetadataOf<typeof MyPropertyFactory>, Meta>>;
type _MetaAccessor = Expect<Equal<MetadataOf<typeof MyAccessorFactory>, Meta>>;

type _MetaMethodCompose = Expect<Equal<MetadataOf<typeof MyMethodCompose>, OtherMeta>>;
type _MetaPropertyCompose = Expect<Equal<MetadataOf<typeof MyPropertyCompose>, OtherMeta>>;
type _MetaAccessorCompose = Expect<Equal<MetadataOf<typeof MyAccessorCompose>, OtherMeta>>;

type _ArgsCtorlessClass = Expect<Equal<ArgsOf<typeof MyCtorlessFactory>, [Meta]>>;
type _ArgsCtorlessMethod = Expect<Equal<ArgsOf<typeof UnconstrainedMethodFactory>, [Meta]>>;
type _ArgsCtorlessProperty = Expect<Equal<ArgsOf<typeof UnconstrainedPropertyFactory>, [Meta]>>;
type _ArgsCtorlessAccessor = Expect<Equal<ArgsOf<typeof UnconstrainedAccessorFactory>, [Meta]>>;

type _ArgsClassCompose = Expect<Equal<ArgsOf<typeof MyClassCompose>, [string, number]>>;
type _ArgsMethodCompose = Expect<Equal<ArgsOf<typeof MyMethodCompose>, [Args]>>;
type _ArgsPropertyCompose = Expect<Equal<ArgsOf<typeof MyPropertyCompose>, [Args]>>;
type _ArgsAccessorCompose = Expect<Equal<ArgsOf<typeof MyAccessorCompose>, [Args]>>;

type _ThisClass = Expect<Equal<ThisOf<typeof MyClassFactory>, BaseInstance>>;
type _ThisMethodScoped = Expect<Equal<ThisOf<typeof ScopedMethodFactory>, BaseInstance>>;
type _ThisProperty = Expect<Equal<ThisOf<typeof MyPropertyFactory>, BaseInstance>>;
type _ThisAccessor = Expect<Equal<ThisOf<typeof MyAccessorFactory>, BaseInstance>>;

type _ThisUnconstrainedMethod = Expect<Equal<ThisOf<typeof UnconstrainedMethodFactory>, any>>;
type _ThisUnconstrainedProperty = Expect<Equal<ThisOf<typeof UnconstrainedPropertyFactory>, any>>;
type _ThisUnconstrainedAccessor = Expect<Equal<ThisOf<typeof UnconstrainedAccessorFactory>, any>>;

type _PlainFn = () => void;
interface PlainObject {
	name: string;
}

type _MetaPlainFn = Expect<Equal<MetadataOf<_PlainFn>, never>>;
type _MetaPlainObject = Expect<Equal<MetadataOf<PlainObject>, never>>;
type _ArgsPlainFn = Expect<Equal<ArgsOf<_PlainFn>, never>>;
type _ArgsPlainObject = Expect<Equal<ArgsOf<PlainObject>, never>>;
type _ThisPlainFn = Expect<Equal<ThisOf<_PlainFn>, never>>;
type _ThisPlainObject = Expect<Equal<ThisOf<PlainObject>, never>>;

// --- TThis slot constraints (compile-time) --------------------------------

class ThisConstraintBase {
	listen(): void {}
}

class ChildListener extends ThisConstraintBase {
	handle(): void {}
}

class ThisConstraintUnrelated {
	whatever(): void {}
}

describe("types: TThis constraint on decorate.method", () => {
	test("rejects unrelated class and accepts subclass at compile time", () => {
		const BaseMethod = decorate.method<Meta, [Meta], () => void, ThisConstraintBase>();

		class GoodChild extends ThisConstraintBase {
			@BaseMethod({ v: "v" })
			handle(): void {}
		}
		void GoodChild;

		class GoodBase extends ThisConstraintBase {
			@BaseMethod({ v: "v" })
			override listen(): void {}
		}
		void GoodBase;

		class RejectUnrelated {
			// @ts-expect-error: ThisConstraintBase-bound TThis rejects unrelated container class
			@BaseMethod({ v: "v" })
			handle(): void {}
		}
		void RejectUnrelated;
	});

	test("default TThis accepts any containing class", () => {
		const Permissive = decorate.method<Meta>();

		class A {
			@Permissive({ v: "v" })
			run(): void {}
		}
		void A;

		class B {
			@Permissive({ v: "v" })
			run(): void {}
		}
		void B;
	});
});

describe("types: TThis constraint on decorate.property", () => {
	test("rejects unrelated class and accepts subclass at compile time", () => {
		const BaseField = decorate.property<Meta, [Meta], unknown, ThisConstraintBase>();

		class GoodChild extends ThisConstraintBase {
			@BaseField({ v: "v" })
			flag!: boolean;
		}
		void GoodChild;

		class RejectUnrelated {
			// @ts-expect-error: ThisConstraintBase-bound TThis rejects unrelated container class
			@BaseField({ v: "v" })
			flag!: boolean;
		}
		void RejectUnrelated;
	});

	test("back-compat: 3-generic form compiles without padding", () => {
		const IsNumber = decorate.property<{ kind: "number" }, [], number>();

		class Account {
			@IsNumber()
			balance!: number;
		}
		void Account;

		class Ledger {
			// @ts-expect-error: number-bound TField rejects boolean
			@IsNumber()
			active!: boolean;
		}
		void Ledger;
	});

	test("combines TField and TThis constraints", () => {
		const NumberFieldOnChild = decorate.property<Meta, [Meta], number, ChildListener>();

		class GoodChild extends ChildListener {
			@NumberFieldOnChild({ v: "v" })
			count!: number;
		}
		void GoodChild;

		class RejectWrongThis {
			// @ts-expect-error: ChildListener-bound TThis rejects unrelated container class
			@NumberFieldOnChild({ v: "v" })
			count!: number;
		}
		void RejectWrongThis;
	});
});

describe("types: TThis constraint on intercept.accessor", () => {
	test("rejects unrelated class and accepts subclass at compile time", () => {
		const BaseAccessor = intercept.accessor<Meta, [Meta], number, ThisConstraintBase>({
			onGet: (original) => original,
		});

		class GoodChild extends ThisConstraintBase {
			@BaseAccessor({ v: "v" })
			accessor count = 0;
		}
		void GoodChild;

		class RejectUnrelated {
			// @ts-expect-error: ThisConstraintBase-bound TThis rejects unrelated container class
			@BaseAccessor({ v: "v" })
			accessor count = 0;
		}
		void RejectUnrelated;
	});
});

void ThisConstraintUnrelated;

test("types: MetadataOf, ArgsOf, ThisOf compile-only assertions", () => {
	void MyClassFactory;
	void MyCtorlessFactory;
	void MyClassCompose;
	void MyMethodFactory;
	void UnconstrainedMethodFactory;
	void ScopedMethodFactory;
	void MyMethodCompose;
	void MyPropertyFactory;
	void UnconstrainedPropertyFactory;
	void MyPropertyCompose;
	void MyAccessorFactory;
	void UnconstrainedAccessorFactory;
	void MyAccessorCompose;
});
