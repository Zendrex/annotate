/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
/** biome-ignore-all lint/complexity/noVoid: discard class reference to avoid unused-variable warning in test */
/** biome-ignore-all lint/suspicious/useAwait: async keyword is the constraint under test — no real await needed */
/** biome-ignore-all lint/suspicious/noExplicitAny: ThisOf for unconstrained factories is intentionally any */
import { decorate, intercept } from "../../../src";
import type { ArgsOf, MetadataOf, ThisOf } from "../../../src";

interface Meta {
	v: string;
}

// --- MetadataOf / ArgsOf / ThisOf slot wiring (compile-only) ----------------

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

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

// --- decorate.property type constraints ---

const NumberField = decorate.property<Meta, [Meta], number>();

class P_AcceptNumber {
	@NumberField({ v: "v" })
	ok!: number;
}
void P_AcceptNumber;

class P_AcceptLiteral {
	@NumberField({ v: "v" })
	narrow!: 1 | 2 | 3;
}
void P_AcceptLiteral;

class P_AcceptOptional {
	// @ts-expect-error: number-bound rejects optional (number | undefined) field
	@NumberField({ v: "v" })
	maybe?: number;
}
void P_AcceptOptional;

class P_AcceptAny {
	// any-typed fields always pass — documented loophole
	@NumberField({ v: "v" })
	loose!: any;
}
void P_AcceptAny;

class P_RejectBoolean {
	// @ts-expect-error: number-bound rejects boolean field
	@NumberField({ v: "v" })
	flag!: boolean;
}
void P_RejectBoolean;

class P_RejectUnion {
	// @ts-expect-error: number-bound rejects wider union
	@NumberField({ v: "v" })
	either!: number | string;
}
void P_RejectUnion;

class P_RejectUnknown {
	// @ts-expect-error: number-bound rejects unknown
	@NumberField({ v: "v" })
	free!: unknown;
}
void P_RejectUnknown;

class Animal {
	breathe(): void {}
}
class Dog extends Animal {
	bark(): void {}
}
const DogField = decorate.property<Meta, [Meta], Dog>();

class P_RejectSupertype {
	// @ts-expect-error: Dog-bound rejects Animal supertype
	@DogField({ v: "v" })
	pet!: Animal;
}
void P_RejectSupertype;

const PermissiveField = decorate.property<Meta>();
class P_PermissiveAccepts {
	@PermissiveField({ v: "v" })
	whatever!: { complex: { type: () => boolean } };
}
void P_PermissiveAccepts;

// --- decorate.class type constraints ---

class Component {
	render(): void {}
}
const Cmp = decorate.class<Meta, [Meta], Component>();

@Cmp({ v: "v" })
class C_Ok extends Component {}
void C_Ok;

// @ts-expect-error: not a Component subclass
@Cmp({ v: "v" })
class C_NotComponent {}
void C_NotComponent;

// --- decorate.method type constraints ---

const AsyncOnly = decorate.method<Meta, [Meta], (...a: unknown[]) => Promise<unknown>>();

class M_AsyncOk {
	@AsyncOnly({ v: "v" })
	async run(): Promise<unknown> {
		return Promise.resolve();
	}
}
void M_AsyncOk;

class M_RejectSync {
	// @ts-expect-error: sync method rejected by async-only constraint
	@AsyncOnly({ v: "v" })
	run(): void {}
}
void M_RejectSync;

// --- intercept.accessor: rejects plain field application ---

const Acc = intercept.accessor<Meta, [Meta], number>({
	onGet: (original) => original,
});

class A_Ok {
	@Acc({ v: "v" })
	accessor x = 0;
}
void A_Ok;

class A_RejectField {
	// @ts-expect-error: accessor-only decorator rejected on plain field
	@Acc({ v: "v" })
	x!: number;
}
void A_RejectField;

// --- TThis slot constraints (compile-time) ----------------------------------

class ThisConstraintBase {
	listen(): void {}
}

class ChildListener extends ThisConstraintBase {
	handle(): void {}
}

class ThisConstraintUnrelated {
	whatever(): void {}
}

const BaseMethod = decorate.method<Meta, [Meta], () => void, ThisConstraintBase>();

class TThis_GoodChild extends ThisConstraintBase {
	@BaseMethod({ v: "v" })
	handle(): void {}
}
void TThis_GoodChild;

class TThis_GoodBase extends ThisConstraintBase {
	@BaseMethod({ v: "v" })
	override listen(): void {}
}
void TThis_GoodBase;

class TThis_RejectUnrelated {
	// @ts-expect-error: ThisConstraintBase-bound TThis rejects unrelated container class
	@BaseMethod({ v: "v" })
	handle(): void {}
}
void TThis_RejectUnrelated;

const PermissiveMethod = decorate.method<Meta>();

class TThis_PermissiveA {
	@PermissiveMethod({ v: "v" })
	run(): void {}
}
void TThis_PermissiveA;

class TThis_PermissiveB {
	@PermissiveMethod({ v: "v" })
	run(): void {}
}
void TThis_PermissiveB;

const BaseField = decorate.property<Meta, [Meta], unknown, ThisConstraintBase>();

class TThis_FieldGoodChild extends ThisConstraintBase {
	@BaseField({ v: "v" })
	flag!: boolean;
}
void TThis_FieldGoodChild;

class TThis_FieldRejectUnrelated {
	// @ts-expect-error: ThisConstraintBase-bound TThis rejects unrelated container class
	@BaseField({ v: "v" })
	flag!: boolean;
}
void TThis_FieldRejectUnrelated;

const IsNumber = decorate.property<{ kind: "number" }, [], number>();

class TThis_Account {
	@IsNumber()
	balance!: number;
}
void TThis_Account;

class TThis_Ledger {
	// @ts-expect-error: number-bound TField rejects boolean
	@IsNumber()
	active!: boolean;
}
void TThis_Ledger;

const NumberFieldOnChild = decorate.property<Meta, [Meta], number, ChildListener>();

class TThis_GoodChildCount extends ChildListener {
	@NumberFieldOnChild({ v: "v" })
	count!: number;
}
void TThis_GoodChildCount;

class TThis_RejectWrongThis {
	// @ts-expect-error: ChildListener-bound TThis rejects unrelated container class
	@NumberFieldOnChild({ v: "v" })
	count!: number;
}
void TThis_RejectWrongThis;

const BaseAccessor = intercept.accessor<Meta, [Meta], number, ThisConstraintBase>({
	onGet: (original) => original,
});

class TThis_AccessorGoodChild extends ThisConstraintBase {
	@BaseAccessor({ v: "v" })
	accessor count = 0;
}
void TThis_AccessorGoodChild;

class TThis_AccessorRejectUnrelated {
	// @ts-expect-error: ThisConstraintBase-bound TThis rejects unrelated container class
	@BaseAccessor({ v: "v" })
	accessor count = 0;
}
void TThis_AccessorRejectUnrelated;

void ThisConstraintUnrelated;

// --- Factory.derive Pick (compose omitted) ---------------------------------

const DerivePickParent = decorate.class<string>({ name: "Parent" });
// @ts-expect-error — compose is omitted from the derive() Pick signature.
DerivePickParent.derive({ compose: (x: string) => x });
