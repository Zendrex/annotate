/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test stub methods and classes */
/** biome-ignore-all lint/complexity/noVoid: discard references to avoid unused-variable warnings in type tests */
/** biome-ignore-all lint/suspicious/useAwait: async keyword is the constraint under test — no real await needed */
/** biome-ignore-all lint/suspicious/noExplicitAny: ThisOf for unconstrained factories is intentionally any */

import { Annotate, reflect } from "../../src";
import { createAccessorInterceptor, createAccessorListInterceptor } from "../../src/factories/accessor-interceptor";
import { createClassDecorator, createClassListDecorator } from "../../src/factories/class-decorator";
import { createMethodDecorator, createMethodListDecorator } from "../../src/factories/method-decorator";
import { createMethodListInterceptor } from "../../src/factories/method-interceptor";
import { createPropertyDecorator, createPropertyListDecorator } from "../../src/factories/property-decorator";
import { mintListKey, mintUniqueKey } from "../../src/metadata/cardinality";
import { createScopedReflector } from "../../src/reflector/scoped-reflector";
import type {
	Cardinality as AnnotateCardinality,
	DecoratedClassList,
	DecoratedClassUnique,
	DecoratedItem,
	DecoratedMethodList,
	DecoratedMethodUnique,
	DecoratedPropertyList,
	DecoratedPropertyUnique,
	IScopedReflector,
	ListMetadataKey,
	MetadataKey,
	UniqueMetadataKey,
} from "../../src";
import type { ArgsOf, CardinalityOf, MetadataOf, ThisOf } from "../../src/factories/types";

// ── Shared helpers ────────────────────────────────────────────────────────────

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

class Fixture {
	method(): void {}
	field!: string;
	static health(): void {}
}

// =============================================================================
// Annotate public API — handles, mapper inference, selector reads
// =============================================================================

const _annotateCardinality: AnnotateCardinality = "many";
void _annotateCardinality;

const AnnotateRoute = Annotate.method((method: "GET" | "POST", path: string) => ({ method, path }));
class A_PublicMethodApi {
	@AnnotateRoute("GET", "/")
	index(): void {}

	// @ts-expect-error: mapper-inferred decorator args reject invalid methods
	@AnnotateRoute("DELETE", "/")
	delete(): void {}
}
void A_PublicMethodApi;

const AnnotateRole = Annotate.method<string>();
const _annotateOneRead: string | undefined = AnnotateRole.read(Fixture).get((fixture) => fixture.method);
void _annotateOneRead;

const AnnotateTags = Annotate.method<string>({ cardinality: "many" });
const _annotateManyRead: readonly string[] = AnnotateTags.read(Fixture).get((fixture) => fixture.method);
void _annotateManyRead;
// @ts-expect-error: many-cardinality reads return arrays, not scalar metadata
const _annotateManyAsOne: string | undefined = AnnotateTags.read(Fixture).get((fixture) => fixture.method);
void _annotateManyAsOne;

const AnnotateStatic = Annotate.method<string>();
const _annotateStaticRead: string | undefined = AnnotateStatic.read(Fixture).static.get((fixture) => fixture.health);
void _annotateStaticRead;

const AnnotateClassMeta = Annotate.class<string>({ label: "ClassMeta" });
const _annotateClassRead: string | undefined = AnnotateClassMeta.read(Fixture).get();
void _annotateClassRead;

const AnnotateFieldMeta = Annotate.field<string>();
const _annotateFieldRead: string | undefined = AnnotateFieldMeta.read(Fixture).get((fixture) => fixture.field);
void _annotateFieldRead;

// Cross-section factories used by the list-brand and reflector sections.
const UniqueMethod = createMethodDecorator<string>();
const ListMethod = createMethodListDecorator<string>();
const UniqueProperty = createPropertyDecorator<string>();
const ListProperty = createPropertyListDecorator<string>();
const UniqueClass = createClassDecorator<string>();
const ListClass = createClassListDecorator<string>();

// =============================================================================
// metadata/types — key brand assignability
// =============================================================================

declare const uniqueKey: UniqueMetadataKey<string>;
const _sym: symbol = uniqueKey;
void _sym;

declare const bare: symbol;
// @ts-expect-error: bare symbol must not satisfy the brand
const _branded: UniqueMetadataKey<string> = bare;
void _branded;

declare const uniqueMeta: MetadataKey<string, "unique">;
// @ts-expect-error: cardinality mismatch — unique key is not a list key
const _asList: MetadataKey<string, "list"> = uniqueMeta;
void _asList;

declare const listKey: ListMetadataKey<number>;
const _listSym: symbol = listKey;
void _listSym;

const minted = mintUniqueKey<string>("type-test");
const _mintedCheck: UniqueMetadataKey<string> = minted;
void _mintedCheck;

const mintedList = mintListKey<number>("type-test-list");
const _mintedListCheck: ListMetadataKey<number> = mintedList;
void _mintedListCheck;

declare const defaultKey: MetadataKey;
const _defaultSym: symbol = defaultKey;
void _defaultSym;

// =============================================================================
// factories/types — MetadataOf / ArgsOf / ThisOf slot wiring
// =============================================================================

const MyClassFactory = createClassDecorator<Meta, [Meta], BaseInstance>();
const MyCtorlessFactory = createClassDecorator<Meta>();
const MyClassCompose = createClassDecorator<Meta, [string, number], BaseInstance>({
	compose: (tag, count) => ({ v: `${tag}:${count}` }),
});

const MyMethodFactory = createMethodDecorator<Meta, [Meta], () => void, BaseInstance>();
const UnconstrainedMethodFactory = createMethodDecorator<Meta>();
const ScopedMethodFactory = createMethodDecorator<Meta, [Meta], () => void, BaseInstance>();
const MyMethodCompose = createMethodDecorator<OtherMeta, [Args], () => void>({
	compose: (a) => ({ kind: "other", ...a }),
});

const MyPropertyFactory = createPropertyDecorator<Meta, [Meta], number, BaseInstance>();
const UnconstrainedPropertyFactory = createPropertyDecorator<Meta>();
const MyPropertyCompose = createPropertyDecorator<OtherMeta, [Args], unknown>({
	compose: (a) => ({ kind: "other", ...a }),
});

const MyAccessorFactory = createAccessorInterceptor<Meta, [Meta], number, BaseInstance>({
	onGet: (original) => original,
});
const UnconstrainedAccessorFactory = createAccessorInterceptor<Meta, [Meta], number>({
	onGet: (original) => original,
});
const MyAccessorCompose = createAccessorInterceptor<OtherMeta, [Args], number>({
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

type _CardClassUnique = Expect<Equal<CardinalityOf<typeof UniqueClass>, "unique">>;
type _CardClassList = Expect<Equal<CardinalityOf<typeof ListClass>, "list">>;
type _CardMethodUnique = Expect<Equal<CardinalityOf<typeof UniqueMethod>, "unique">>;
type _CardMethodList = Expect<Equal<CardinalityOf<typeof ListMethod>, "list">>;
type _CardPropertyUnique = Expect<Equal<CardinalityOf<typeof UniqueProperty>, "unique">>;
type _CardPropertyList = Expect<Equal<CardinalityOf<typeof ListProperty>, "list">>;
type _CardPlainFn = Expect<Equal<CardinalityOf<_PlainFn>, never>>;

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

// ── createPropertyDecorator type constraints ───────────────────────────────────────

const NumberField = createPropertyDecorator<Meta, [Meta], number>();

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
const DogField = createPropertyDecorator<Meta, [Meta], Dog>();

class P_RejectSupertype {
	// @ts-expect-error: Dog-bound rejects Animal supertype
	@DogField({ v: "v" })
	pet!: Animal;
}
void P_RejectSupertype;

const PermissiveField = createPropertyDecorator<Meta>();
class P_PermissiveAccepts {
	@PermissiveField({ v: "v" })
	whatever!: { complex: { type: () => boolean } };
}
void P_PermissiveAccepts;

// ── createClassDecorator type constraints ──────────────────────────────────────────

class Component {
	render(): void {}
}
const Cmp = createClassDecorator<Meta, [Meta], Component>();

@Cmp({ v: "v" })
class C_Ok extends Component {}
void C_Ok;

// @ts-expect-error: not a Component subclass
@Cmp({ v: "v" })
class C_NotComponent {}
void C_NotComponent;

// ── createMethodDecorator type constraints ─────────────────────────────────────────

const AsyncOnly = createMethodDecorator<Meta, [Meta], (...a: unknown[]) => Promise<unknown>>();

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

// ── createAccessorInterceptor: rejects plain field application ──────────────────────

const Acc = createAccessorInterceptor<Meta, [Meta], number>({
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

// ── TThis slot constraints ───────────────────────────────────────────────────

class ThisConstraintBase {
	listen(): void {}
}

class ChildListener extends ThisConstraintBase {
	handle(): void {}
}

class ThisConstraintUnrelated {
	whatever(): void {}
}

const BaseMethod = createMethodDecorator<Meta, [Meta], () => void, ThisConstraintBase>();

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

const PermissiveMethod = createMethodDecorator<Meta>();

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

const BaseField = createPropertyDecorator<Meta, [Meta], unknown, ThisConstraintBase>();

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

const IsNumber = createPropertyDecorator<{ kind: "number" }, [], number>();

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

const NumberFieldOnChild = createPropertyDecorator<Meta, [Meta], number, ChildListener>();

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

const BaseAccessor = createAccessorInterceptor<Meta, [Meta], number, ThisConstraintBase>({
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

// ── Factory.derive Pick (compose omitted) ────────────────────────────────────

const DerivePickParent = createClassDecorator<string>({ name: "Parent" });
// @ts-expect-error — compose is omitted from the derive() Pick signature.
DerivePickParent.derive({ compose: (x: string) => x });

// =============================================================================
// factories/types-list — list vs unique key brand preservation
// =============================================================================

// createMethodListDecorator

const _mlKey: ListMetadataKey<string> = ListMethod.key;
void _mlKey;

// @ts-expect-error: ListMetadataKey is not assignable to UniqueMetadataKey
const _mlKeyUnique: UniqueMetadataKey<string> = ListMethod.key;
void _mlKeyUnique;

const _mlDerived = ListMethod.derive();
const _mlDerivedKey: ListMetadataKey<string> = _mlDerived.key;
void _mlDerivedKey;

// @ts-expect-error: derive() result .key is ListMetadataKey, not UniqueMetadataKey
const _mlDerivedKeyUnique: UniqueMetadataKey<string> = _mlDerived.key;
void _mlDerivedKeyUnique;

// createClassListDecorator

const ClassListNum = createClassListDecorator<number>();

const _clKey: ListMetadataKey<number> = ClassListNum.key;
void _clKey;

// @ts-expect-error: ListMetadataKey<number> is not assignable to UniqueMetadataKey<number>
const _clKeyUnique: UniqueMetadataKey<number> = ClassListNum.key;
void _clKeyUnique;

const _clDerived = ClassListNum.derive();
const _clDerivedKey: ListMetadataKey<number> = _clDerived.key;
void _clDerivedKey;

// @ts-expect-error: derive() result .key is ListMetadataKey, not UniqueMetadataKey
const _clDerivedKeyUnique: UniqueMetadataKey<number> = _clDerived.key;
void _clDerivedKeyUnique;

// createPropertyListDecorator

const PropertyListBool = createPropertyListDecorator<boolean>();

const _plKey: ListMetadataKey<boolean> = PropertyListBool.key;
void _plKey;

// @ts-expect-error: ListMetadataKey<boolean> is not assignable to UniqueMetadataKey<boolean>
const _plKeyUnique: UniqueMetadataKey<boolean> = PropertyListBool.key;
void _plKeyUnique;

const _plDerived = PropertyListBool.derive();
const _plDerivedKey: ListMetadataKey<boolean> = _plDerived.key;
void _plDerivedKey;

// @ts-expect-error: derive() result .key is ListMetadataKey, not UniqueMetadataKey
const _plDerivedKeyUnique: UniqueMetadataKey<boolean> = _plDerived.key;
void _plDerivedKeyUnique;

// createMethodListInterceptor

const MethodIntList = createMethodListInterceptor<string>({
	intercept: (original) => original,
});

const _milKey: ListMetadataKey<string> = MethodIntList.key;
void _milKey;

// @ts-expect-error: ListMetadataKey<string> is not assignable to UniqueMetadataKey<string>
const _milKeyUnique: UniqueMetadataKey<string> = MethodIntList.key;
void _milKeyUnique;

const _milDerived = MethodIntList.derive();
const _milDerivedKey: ListMetadataKey<string> = _milDerived.key;
void _milDerivedKey;

// @ts-expect-error: derive() result .key is ListMetadataKey, not UniqueMetadataKey
const _milDerivedKeyUnique: UniqueMetadataKey<string> = _milDerived.key;
void _milDerivedKeyUnique;

// createAccessorListInterceptor

const AccList = createAccessorListInterceptor<string, [string], number>({
	onGet: (original) => original,
});

const _alKey: ListMetadataKey<string> = AccList.key;
void _alKey;

// @ts-expect-error: ListMetadataKey<string> is not assignable to UniqueMetadataKey<string>
const _alKeyUnique: UniqueMetadataKey<string> = AccList.key;
void _alKeyUnique;

const _alDerived = AccList.derive();
const _alDerivedKey: ListMetadataKey<string> = _alDerived.key;
void _alDerivedKey;

// @ts-expect-error: derive() result .key is ListMetadataKey, not UniqueMetadataKey
const _alDerivedKeyUnique: UniqueMetadataKey<string> = _alDerived.key;
void _alDerivedKeyUnique;

// Unique factories keep their UniqueMetadataKey brand.

const _muKey: UniqueMetadataKey<string> = UniqueMethod.key;
void _muKey;

// @ts-expect-error: UniqueMetadataKey is not assignable to ListMetadataKey
const _muKeyList: ListMetadataKey<string> = UniqueMethod.key;
void _muKeyList;

// .list is NOT on the returned factory (only on the namespace).

// @ts-expect-error: returned factory does not expose .list
const _factoryList = UniqueMethod.list;
void _factoryList;

// =============================================================================
// reflector/types — methods/properties/class/all narrows on key brand
// =============================================================================

// methods()
const uniqueMethods: DecoratedMethodUnique<string>[] = reflect(Fixture).methods(UniqueMethod.key);
void uniqueMethods;

const listMethods: DecoratedMethodList<string>[] = reflect(Fixture).methods(ListMethod.key);
void listMethods;

// @ts-expect-error: unique key methods are not assignable to DecoratedMethodList[]
const _uniqueAsListMethods: DecoratedMethodList<string>[] = reflect(Fixture).methods(UniqueMethod.key);
void _uniqueAsListMethods;

// @ts-expect-error: list key methods are not assignable to DecoratedMethodUnique[]
const _listAsUniqueMethods: DecoratedMethodUnique<string>[] = reflect(Fixture).methods(ListMethod.key);
void _listAsUniqueMethods;

// properties()
const uniqueProps: DecoratedPropertyUnique<string>[] = reflect(Fixture).properties(UniqueProperty.key);
void uniqueProps;

const listProps: DecoratedPropertyList<string>[] = reflect(Fixture).properties(ListProperty.key);
void listProps;

// @ts-expect-error: unique key properties are not assignable to DecoratedPropertyList[]
const _uniqueAsListProps: DecoratedPropertyList<string>[] = reflect(Fixture).properties(UniqueProperty.key);
void _uniqueAsListProps;

// @ts-expect-error: list key properties are not assignable to DecoratedPropertyUnique[]
const _listAsUniqueProps: DecoratedPropertyUnique<string>[] = reflect(Fixture).properties(ListProperty.key);
void _listAsUniqueProps;

// class()
const uniqueClass: DecoratedClassUnique<string> | undefined = reflect(Fixture).class(UniqueClass.key);
void uniqueClass;

const listClass: DecoratedClassList<string> | undefined = reflect(Fixture).class(ListClass.key);
void listClass;

// @ts-expect-error: unique key class result is not assignable to DecoratedClassList | undefined
const _uniqueAsListClass: DecoratedClassList<string> | undefined = reflect(Fixture).class(UniqueClass.key);
void _uniqueAsListClass;

// @ts-expect-error: list key class result is not assignable to DecoratedClassUnique | undefined
const _listAsUniqueClass: DecoratedClassUnique<string> | undefined = reflect(Fixture).class(ListClass.key);
void _listAsUniqueClass;

// all()
const uniqueAll: DecoratedItem<string, "unique">[] = reflect(Fixture).all(UniqueMethod.key);
void uniqueAll;

const listAll: DecoratedItem<string, "list">[] = reflect(Fixture).all(ListMethod.key);
void listAll;

// @ts-expect-error: unique key all() result is not assignable to DecoratedItem<string, "list">[]
const _uniqueAllAsList: DecoratedItem<string, "list">[] = reflect(Fixture).all(UniqueMethod.key);
void _uniqueAllAsList;

// @ts-expect-error: list key all() result is not assignable to DecoratedItem<string, "unique">[]
const _listAllAsUnique: DecoratedItem<string, "unique">[] = reflect(Fixture).all(ListMethod.key);
void _listAllAsUnique;

// ── createScopedReflector infers TCard from key brand ────────────────────────

// biome-ignore lint/complexity/noBannedTypes: needed for constructor type
const ctor = Fixture as Function & { prototype: object };

const scopedUnique: IScopedReflector<string, "unique"> = createScopedReflector(ctor, UniqueMethod.key);
void scopedUnique;

const scopedList: IScopedReflector<string, "list"> = createScopedReflector(ctor, ListMethod.key);
void scopedList;

// @ts-expect-error: unique-key scoped reflector is not assignable to IScopedReflector<string, "list">
const _scopedUniqueAsList: IScopedReflector<string, "list"> = createScopedReflector(ctor, UniqueMethod.key);
void _scopedUniqueAsList;

// @ts-expect-error: list-key scoped reflector is not assignable to IScopedReflector<string, "unique">
const _scopedListAsUnique: IScopedReflector<string, "unique"> = createScopedReflector(ctor, ListMethod.key);
void _scopedListAsUnique;

// class & property keys
const scopedUniqueClass = createScopedReflector(ctor, UniqueClass.key);
void scopedUniqueClass;
const scopedListClass = createScopedReflector(ctor, ListClass.key);
void scopedListClass;
const scopedUniqueProperty = createScopedReflector(ctor, UniqueProperty.key);
void scopedUniqueProperty;
const scopedListProperty = createScopedReflector(ctor, ListProperty.key);
void scopedListProperty;

// @ts-expect-error: unique-key scoped reflector is not assignable to IScopedReflector<string, "list">
const _uniqueClassKeyAsList: IScopedReflector<string, "list"> = createScopedReflector(ctor, UniqueClass.key);
void _uniqueClassKeyAsList;

// @ts-expect-error: list-key scoped reflector is not assignable to IScopedReflector<string, "unique">
const _listClassKeyAsUnique: IScopedReflector<string, "unique"> = createScopedReflector(ctor, ListClass.key);
void _listClassKeyAsUnique;

// @ts-expect-error: unique-key scoped reflector is not assignable to IScopedReflector<string, "list">
const _uniquePropertyKeyAsList: IScopedReflector<string, "list"> = createScopedReflector(ctor, UniqueProperty.key);
void _uniquePropertyKeyAsList;

// @ts-expect-error: list-key scoped reflector is not assignable to IScopedReflector<string, "unique">
const _listPropertyKeyAsUnique: IScopedReflector<string, "unique"> = createScopedReflector(ctor, ListProperty.key);
void _listPropertyKeyAsUnique;

// ── IScopedReflector: class() / properties() narrowing ────────────────────────

const scopedUniquePropertyEntries: DecoratedPropertyUnique<string>[] = scopedUniqueProperty.properties();
void scopedUniquePropertyEntries;

// @ts-expect-error: unique-scoped properties() not assignable to DecoratedPropertyList<string>[]
const _scopedUniquePropsAsList: DecoratedPropertyList<string>[] = scopedUniqueProperty.properties();
void _scopedUniquePropsAsList;

const scopedListPropertyEntries: DecoratedPropertyList<string>[] = scopedListProperty.properties();
void scopedListPropertyEntries;

// @ts-expect-error: list-scoped properties() not assignable to DecoratedPropertyUnique<string>[]
const _scopedListPropsAsUnique: DecoratedPropertyUnique<string>[] = scopedListProperty.properties();
void _scopedListPropsAsUnique;

const scopedUniqueClassResult: DecoratedClassUnique<string> | undefined = scopedUniqueClass.class();
void scopedUniqueClassResult;

// @ts-expect-error: unique-scoped class() not assignable to DecoratedClassList | undefined
const _scopedUniqueClassAsList: DecoratedClassList<string> | undefined = scopedUniqueClass.class();
void _scopedUniqueClassAsList;

const scopedListClassResult: DecoratedClassList<string> | undefined = scopedListClass.class();
void scopedListClassResult;

// @ts-expect-error: list-scoped class() not assignable to DecoratedClassUnique | undefined
const _scopedListClassAsUnique: DecoratedClassUnique<string> | undefined = scopedListClass.class();
void _scopedListClassAsUnique;

// methods() narrowing

const scopedUniqueMethodEntries: DecoratedMethodUnique<string>[] = scopedUnique.methods();
void scopedUniqueMethodEntries;

const scopedListMethodEntries: DecoratedMethodList<string>[] = scopedList.methods();
void scopedListMethodEntries;

// @ts-expect-error: unique-scoped methods() not assignable to DecoratedMethodList[]
const _scopedUniqueMethodsAsList: DecoratedMethodList<string>[] = scopedUnique.methods();
void _scopedUniqueMethodsAsList;

// methodsScalar / propertiesScalar are NOT on IScopedReflector

// @ts-expect-error: methodsScalar was removed in T4
const _methodsScalar = scopedUnique.methodsScalar;
void _methodsScalar;

// @ts-expect-error: propertiesScalar was removed in T4
const _propertiesScalar = scopedUnique.propertiesScalar;
void _propertiesScalar;

// ── Factory.reader() return type narrows on TCard ────────────────────────────

const _factoryReaderUnique: IScopedReflector<string, "unique"> = UniqueMethod.reader(Fixture);
void _factoryReaderUnique;

const _factoryReaderList: IScopedReflector<string, "list"> = ListMethod.reader(Fixture);
void _factoryReaderList;

// @ts-expect-error: unique factory reader is not IScopedReflector<string, "list">
const _factoryUniqueReaderAsList: IScopedReflector<string, "list"> = UniqueMethod.reader(Fixture);
void _factoryUniqueReaderAsList;
