/**
 * Compile-time type tests for `createScopedReflector` brand inference.
 *
 * Per spec §3 Data flow and §4: `createScopedReflector` infers `ScopedReflector<T, TCard>`
 * from the key brand, and each query method narrows its return shape accordingly.
 *
 * This file intentionally has no runtime assertions — TypeScript errors are the test
 * signal. A `@ts-expect-error` that does NOT produce an error means type narrowing broke.
 */
/** biome-ignore-all lint/complexity/noVoid: discard references to avoid unused-variable warnings in type tests */
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test fixture classes */

import { decorate } from "../../../src";
import { createScopedReflector } from "../../../src/reflector/scoped-reflector";
import type {
	DecoratedClassList,
	DecoratedClassUnique,
	DecoratedMethodList,
	DecoratedMethodUnique,
	DecoratedPropertyList,
	DecoratedPropertyUnique,
	ScopedReflector,
} from "../../../src";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const UniqueMethod = decorate.method<string>();
const ListMethod = decorate.method.list<string>();
const UniqueClass = decorate.class<string>();
const ListClass = decorate.class.list<string>();
const UniqueProperty = decorate.property<string>();
const ListProperty = decorate.property.list<string>();

class Fixture {
	method(): void {}
	field!: string;
}

// biome-ignore lint/complexity/noBannedTypes: needed for constructor type
const ctor = Fixture as Function & { prototype: object };

// ── createScopedReflector infers ScopedReflector<T, "unique"> for unique keys ──

// Unique method key → ScopedReflector<string, "unique">
const scopedUniqueMethod: ScopedReflector<string, "unique"> = createScopedReflector(ctor, UniqueMethod.key);
void scopedUniqueMethod;

// Unique class key → ScopedReflector<string, "unique">
const scopedUniqueClass: ScopedReflector<string, "unique"> = createScopedReflector(ctor, UniqueClass.key);
void scopedUniqueClass;

// Unique property key → ScopedReflector<string, "unique">
const scopedUniqueProperty: ScopedReflector<string, "unique"> = createScopedReflector(ctor, UniqueProperty.key);
void scopedUniqueProperty;

// ── createScopedReflector infers ScopedReflector<T, "list"> for list keys ─────

// List method key → ScopedReflector<string, "list">
const scopedListMethod: ScopedReflector<string, "list"> = createScopedReflector(ctor, ListMethod.key);
void scopedListMethod;

// List class key → ScopedReflector<string, "list">
const scopedListClass: ScopedReflector<string, "list"> = createScopedReflector(ctor, ListClass.key);
void scopedListClass;

// List property key → ScopedReflector<string, "list">
const scopedListProperty: ScopedReflector<string, "list"> = createScopedReflector(ctor, ListProperty.key);
void scopedListProperty;

// ── Cross-cardinality assignment is rejected ──────────────────────────────────

// @ts-expect-error: unique-key scoped reflector is not assignable to ScopedReflector<string, "list">
const _uniqueMethodAsList: ScopedReflector<string, "list"> = createScopedReflector(ctor, UniqueMethod.key);
void _uniqueMethodAsList;

// @ts-expect-error: list-key scoped reflector is not assignable to ScopedReflector<string, "unique">
const _listMethodAsUnique: ScopedReflector<string, "unique"> = createScopedReflector(ctor, ListMethod.key);
void _listMethodAsUnique;

// @ts-expect-error: unique-key scoped reflector is not assignable to ScopedReflector<string, "list">
const _uniqueClassAsList: ScopedReflector<string, "list"> = createScopedReflector(ctor, UniqueClass.key);
void _uniqueClassAsList;

// @ts-expect-error: list-key scoped reflector is not assignable to ScopedReflector<string, "unique">
const _listClassAsUnique: ScopedReflector<string, "unique"> = createScopedReflector(ctor, ListClass.key);
void _listClassAsUnique;

// @ts-expect-error: unique-key scoped reflector is not assignable to ScopedReflector<string, "list">
const _uniquePropertyAsList: ScopedReflector<string, "list"> = createScopedReflector(ctor, UniqueProperty.key);
void _uniquePropertyAsList;

// @ts-expect-error: list-key scoped reflector is not assignable to ScopedReflector<string, "unique">
const _listPropertyAsUnique: ScopedReflector<string, "unique"> = createScopedReflector(ctor, ListProperty.key);
void _listPropertyAsUnique;

// ── ScopedReflector<T, "unique">.methods() returns DecoratedMethodUnique<T>[] ─

const uniqueMethodEntries: DecoratedMethodUnique<string>[] = scopedUniqueMethod.methods();
void uniqueMethodEntries;

// Unique scoped reflector methods() is NOT assignable to DecoratedMethodList[]
// @ts-expect-error: unique-scoped methods() not assignable to DecoratedMethodList<string>[]
const _uniqueMethodsAsList: DecoratedMethodList<string>[] = scopedUniqueMethod.methods();
void _uniqueMethodsAsList;

// ── ScopedReflector<T, "list">.methods() returns DecoratedMethodList<T>[] ─────

const listMethodEntries: DecoratedMethodList<string>[] = scopedListMethod.methods();
void listMethodEntries;

// List scoped reflector methods() is NOT assignable to DecoratedMethodUnique[]
// @ts-expect-error: list-scoped methods() not assignable to DecoratedMethodUnique<string>[]
const _listMethodsAsUnique: DecoratedMethodUnique<string>[] = scopedListMethod.methods();
void _listMethodsAsUnique;

// ── ScopedReflector<T, "unique">.properties() returns DecoratedPropertyUnique[] ─

const uniquePropertyEntries: DecoratedPropertyUnique<string>[] = scopedUniqueProperty.properties();
void uniquePropertyEntries;

// @ts-expect-error: unique-scoped properties() not assignable to DecoratedPropertyList<string>[]
const _uniquePropsAsList: DecoratedPropertyList<string>[] = scopedUniqueProperty.properties();
void _uniquePropsAsList;

// ── ScopedReflector<T, "list">.properties() returns DecoratedPropertyList[] ───

const listPropertyEntries: DecoratedPropertyList<string>[] = scopedListProperty.properties();
void listPropertyEntries;

// @ts-expect-error: list-scoped properties() not assignable to DecoratedPropertyUnique<string>[]
const _listPropsAsUnique: DecoratedPropertyUnique<string>[] = scopedListProperty.properties();
void _listPropsAsUnique;

// ── ScopedReflector<T, "unique">.class() returns DecoratedClassUnique | undefined ─

const uniqueClassResult: DecoratedClassUnique<string> | undefined = scopedUniqueClass.class();
void uniqueClassResult;

// @ts-expect-error: unique-scoped class() not assignable to DecoratedClassList | undefined
const _uniqueClassAsList2: DecoratedClassList<string> | undefined = scopedUniqueClass.class();
void _uniqueClassAsList2;

// ── ScopedReflector<T, "list">.class() returns DecoratedClassList | undefined ─

const listClassResult: DecoratedClassList<string> | undefined = scopedListClass.class();
void listClassResult;

// @ts-expect-error: list-scoped class() not assignable to DecoratedClassUnique | undefined
const _listClassAsUnique2: DecoratedClassUnique<string> | undefined = scopedListClass.class();
void _listClassAsUnique2;
