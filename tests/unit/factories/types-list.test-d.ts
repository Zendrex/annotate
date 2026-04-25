/**
 * Compile-time type tests for list-cardinality factory shapes.
 *
 * This file intentionally has no runtime assertions. TypeScript errors are the
 * test signal — a `@ts-expect-error` that does NOT produce an error means the
 * type narrowing broke.
 */
/** biome-ignore-all lint/complexity/noVoid: discard class references to avoid unused-variable warnings */
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test stub methods and classes */

import { decorate, intercept } from "../../../src";
import type { ListMetadataKey, UniqueMetadataKey } from "../../../src";

// ── decorate.method.list ──────────────────────────────────────────────────────

const MethodList = decorate.method.list<string>();

// .key is assignable to ListMetadataKey<string>
const _mlKey: ListMetadataKey<string> = MethodList.key;
void _mlKey;

// .key is NOT assignable to UniqueMetadataKey<string>
// @ts-expect-error: ListMetadataKey is not assignable to UniqueMetadataKey
const _mlKeyUnique: UniqueMetadataKey<string> = MethodList.key;
void _mlKeyUnique;

// derive() preserves ListMetadataKey brand
const _mlDerived = MethodList.derive();
const _mlDerivedKey: ListMetadataKey<string> = _mlDerived.key;
void _mlDerivedKey;

// derive() does NOT widen to UniqueMetadataKey
// @ts-expect-error: derive() result .key is ListMetadataKey, not UniqueMetadataKey
const _mlDerivedKeyUnique: UniqueMetadataKey<string> = _mlDerived.key;
void _mlDerivedKeyUnique;

// ── decorate.class.list ───────────────────────────────────────────────────────

const ClassList = decorate.class.list<number>();

const _clKey: ListMetadataKey<number> = ClassList.key;
void _clKey;

// @ts-expect-error: ListMetadataKey<number> is not assignable to UniqueMetadataKey<number>
const _clKeyUnique: UniqueMetadataKey<number> = ClassList.key;
void _clKeyUnique;

// derive() preserves ListMetadataKey brand
const _clDerived = ClassList.derive();
const _clDerivedKey: ListMetadataKey<number> = _clDerived.key;
void _clDerivedKey;

// @ts-expect-error: derive() result .key is ListMetadataKey, not UniqueMetadataKey
const _clDerivedKeyUnique: UniqueMetadataKey<number> = _clDerived.key;
void _clDerivedKeyUnique;

// ── decorate.property.list ────────────────────────────────────────────────────

const PropertyList = decorate.property.list<boolean>();

const _plKey: ListMetadataKey<boolean> = PropertyList.key;
void _plKey;

// @ts-expect-error: ListMetadataKey<boolean> is not assignable to UniqueMetadataKey<boolean>
const _plKeyUnique: UniqueMetadataKey<boolean> = PropertyList.key;
void _plKeyUnique;

// derive() preserves ListMetadataKey brand
const _plDerived = PropertyList.derive();
const _plDerivedKey: ListMetadataKey<boolean> = _plDerived.key;
void _plDerivedKey;

// @ts-expect-error: derive() result .key is ListMetadataKey, not UniqueMetadataKey
const _plDerivedKeyUnique: UniqueMetadataKey<boolean> = _plDerived.key;
void _plDerivedKeyUnique;

// ── intercept.method.list ─────────────────────────────────────────────────────

const MethodIntList = intercept.method.list<string>({
	intercept: (original) => original,
});

const _milKey: ListMetadataKey<string> = MethodIntList.key;
void _milKey;

// @ts-expect-error: ListMetadataKey<string> is not assignable to UniqueMetadataKey<string>
const _milKeyUnique: UniqueMetadataKey<string> = MethodIntList.key;
void _milKeyUnique;

// derive() preserves ListMetadataKey brand
const _milDerived = MethodIntList.derive();
const _milDerivedKey: ListMetadataKey<string> = _milDerived.key;
void _milDerivedKey;

// @ts-expect-error: derive() result .key is ListMetadataKey, not UniqueMetadataKey
const _milDerivedKeyUnique: UniqueMetadataKey<string> = _milDerived.key;
void _milDerivedKeyUnique;

// ── intercept.accessor.list ───────────────────────────────────────────────────

const AccList = intercept.accessor.list<string, [string], number>({
	onGet: (original) => original,
});

const _alKey: ListMetadataKey<string> = AccList.key;
void _alKey;

// @ts-expect-error: ListMetadataKey<string> is not assignable to UniqueMetadataKey<string>
const _alKeyUnique: UniqueMetadataKey<string> = AccList.key;
void _alKeyUnique;

// derive() preserves ListMetadataKey brand
const _alDerived = AccList.derive();
const _alDerivedKey: ListMetadataKey<string> = _alDerived.key;
void _alDerivedKey;

// @ts-expect-error: derive() result .key is ListMetadataKey, not UniqueMetadataKey
const _alDerivedKeyUnique: UniqueMetadataKey<string> = _alDerived.key;
void _alDerivedKeyUnique;

// ── unique factories keep their UniqueMetadataKey brand ───────────────────────

const MethodUniq = decorate.method<string>();

const _muKey: UniqueMetadataKey<string> = MethodUniq.key;
void _muKey;

// @ts-expect-error: UniqueMetadataKey is not assignable to ListMetadataKey
const _muKeyList: ListMetadataKey<string> = MethodUniq.key;
void _muKeyList;

// ── .list is NOT on returned factory (only on the namespace) ─────────────────

const factory = decorate.method<string>();
// The returned factory object should not have a `.list` property.
// Access via decorate.method.list is allowed; access on the returned factory is not.
// @ts-expect-error: returned factory does not expose .list
const _factoryList = factory.list;
void _factoryList;
