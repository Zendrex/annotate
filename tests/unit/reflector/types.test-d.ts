/** biome-ignore-all lint/complexity/noVoid: discard references to avoid unused-variable warnings in type tests */
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test fixture classes */

import { decorate, reflect } from "../../../src";
import { createScopedReflector } from "../../../src/reflector/scoped-reflector";
import type {
	DecoratedClassList,
	DecoratedClassUnique,
	DecoratedItem,
	DecoratedMethodList,
	DecoratedMethodUnique,
	DecoratedPropertyList,
	DecoratedPropertyUnique,
	ScopedReflector,
} from "../../../src";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const UniqueMethod = decorate.method<string>();
const ListMethod = decorate.method.list<string>();
const UniqueProperty = decorate.property<string>();
const ListProperty = decorate.property.list<string>();
const UniqueClass = decorate.class<string>();
const ListClass = decorate.class.list<string>();

class Fixture {
	method(): void {}
	field!: string;
}

// ── Reflector.methods() narrows on key brand ──────────────────────────────────

// Unique key → DecoratedMethodUnique[]
const uniqueMethods: DecoratedMethodUnique<string>[] = reflect(Fixture).methods(UniqueMethod.key);
void uniqueMethods;

// List key → DecoratedMethodList[]
const listMethods: DecoratedMethodList<string>[] = reflect(Fixture).methods(ListMethod.key);
void listMethods;

// Unique result is NOT assignable to DecoratedMethodList[]
// @ts-expect-error: unique key methods are not assignable to DecoratedMethodList[]
const _uniqueAsListMethods: DecoratedMethodList<string>[] = reflect(Fixture).methods(UniqueMethod.key);
void _uniqueAsListMethods;

// List result is NOT assignable to DecoratedMethodUnique[]
// @ts-expect-error: list key methods are not assignable to DecoratedMethodUnique[]
const _listAsUniqueMethods: DecoratedMethodUnique<string>[] = reflect(Fixture).methods(ListMethod.key);
void _listAsUniqueMethods;

// ── Reflector.properties() narrows on key brand ───────────────────────────────

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

// ── Reflector.class() narrows on key brand ────────────────────────────────────

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

// ── Reflector.all() narrows on key brand ─────────────────────────────────────

// Unique key → DecoratedItem<T, "unique">[]
const uniqueAll: DecoratedItem<string, "unique">[] = reflect(Fixture).all(UniqueMethod.key);
void uniqueAll;

// List key → DecoratedItem<T, "list">[]
const listAll: DecoratedItem<string, "list">[] = reflect(Fixture).all(ListMethod.key);
void listAll;

// Unique result is NOT assignable to DecoratedItem<T, "list">[]
// @ts-expect-error: unique key all() result is not assignable to DecoratedItem<string, "list">[]
const _uniqueAllAsList: DecoratedItem<string, "list">[] = reflect(Fixture).all(UniqueMethod.key);
void _uniqueAllAsList;

// List result is NOT assignable to DecoratedItem<T, "unique">[]
// @ts-expect-error: list key all() result is not assignable to DecoratedItem<string, "unique">[]
const _listAllAsUnique: DecoratedItem<string, "unique">[] = reflect(Fixture).all(ListMethod.key);
void _listAllAsUnique;

// ── createScopedReflector infers TCard from key brand ────────────────────────

// biome-ignore lint/complexity/noBannedTypes: needed for constructor type
const ctor = Fixture as Function & { prototype: object };

const scopedUnique: ScopedReflector<string, "unique"> = createScopedReflector(ctor, UniqueMethod.key);
void scopedUnique;

const scopedList: ScopedReflector<string, "list"> = createScopedReflector(ctor, ListMethod.key);
void scopedList;

// @ts-expect-error: unique-key scoped reflector is not assignable to ScopedReflector<string, "list">
const _scopedUniqueAsList: ScopedReflector<string, "list"> = createScopedReflector(ctor, UniqueMethod.key);
void _scopedUniqueAsList;

// @ts-expect-error: list-key scoped reflector is not assignable to ScopedReflector<string, "unique">
const _scopedListAsUnique: ScopedReflector<string, "unique"> = createScopedReflector(ctor, ListMethod.key);
void _scopedListAsUnique;

// ── createScopedReflector: class & property keys ──────────────────────────────

const scopedUniqueClass = createScopedReflector(ctor, UniqueClass.key);
void scopedUniqueClass;
const scopedListClass = createScopedReflector(ctor, ListClass.key);
void scopedListClass;
const scopedUniqueProperty = createScopedReflector(ctor, UniqueProperty.key);
void scopedUniqueProperty;
const scopedListProperty = createScopedReflector(ctor, ListProperty.key);
void scopedListProperty;

// @ts-expect-error: unique-key scoped reflector is not assignable to ScopedReflector<string, "list">
const _uniqueClassKeyAsList: ScopedReflector<string, "list"> = createScopedReflector(ctor, UniqueClass.key);
void _uniqueClassKeyAsList;

// @ts-expect-error: list-key scoped reflector is not assignable to ScopedReflector<string, "unique">
const _listClassKeyAsUnique: ScopedReflector<string, "unique"> = createScopedReflector(ctor, ListClass.key);
void _listClassKeyAsUnique;

// @ts-expect-error: unique-key scoped reflector is not assignable to ScopedReflector<string, "list">
const _uniquePropertyKeyAsList: ScopedReflector<string, "list"> = createScopedReflector(ctor, UniqueProperty.key);
void _uniquePropertyKeyAsList;

// @ts-expect-error: list-key scoped reflector is not assignable to ScopedReflector<string, "unique">
const _listPropertyKeyAsUnique: ScopedReflector<string, "unique"> = createScopedReflector(ctor, ListProperty.key);
void _listPropertyKeyAsUnique;

// ── ScopedReflector: class() / properties() on class- and property-key readers ─

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

// ── ScopedReflector brand-driven metadata narrowing ───────────────────────────

// methods() on unique scoped reflector returns DecoratedMethodUnique[]
const scopedUniqueMethodEntries: DecoratedMethodUnique<string>[] = scopedUnique.methods();
void scopedUniqueMethodEntries;

// methods() on list scoped reflector returns DecoratedMethodList[]
const scopedListMethodEntries: DecoratedMethodList<string>[] = scopedList.methods();
void scopedListMethodEntries;

// @ts-expect-error: unique-scoped methods() not assignable to DecoratedMethodList[]
const _scopedUniqueMethodsAsList: DecoratedMethodList<string>[] = scopedUnique.methods();
void _scopedUniqueMethodsAsList;

// ── methodsScalar / propertiesScalar are NOT on ScopedReflector ──────────────

// @ts-expect-error: methodsScalar was removed in T4
const _methodsScalar = scopedUnique.methodsScalar;
void _methodsScalar;

// @ts-expect-error: propertiesScalar was removed in T4
const _propertiesScalar = scopedUnique.propertiesScalar;
void _propertiesScalar;

// ── Factory reader() return type narrows on TCard ─────────────────────────────

// Unique factory reader returns ScopedReflector<string, "unique">
const _factoryReaderUnique: ScopedReflector<string, "unique"> = UniqueMethod.reader(Fixture);
void _factoryReaderUnique;

// List factory reader returns ScopedReflector<string, "list">
const _factoryReaderList: ScopedReflector<string, "list"> = ListMethod.reader(Fixture);
void _factoryReaderList;

// @ts-expect-error: unique factory reader is not ScopedReflector<string, "list">
const _factoryUniqueReaderAsList: ScopedReflector<string, "list"> = UniqueMethod.reader(Fixture);
void _factoryUniqueReaderAsList;
