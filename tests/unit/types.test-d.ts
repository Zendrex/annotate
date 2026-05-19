/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test stub methods and classes */
/** biome-ignore-all lint/complexity/noVoid: discard references to avoid unused-variable warnings in type tests */
/** biome-ignore-all lint/suspicious/useAwait: async keyword is the constraint under test */
/** biome-ignore-all lint/suspicious/noExplicitAny: public decorators intentionally default to permissive target types */

import { Annotate, mintListKey, mintUniqueKey, reflect } from "../../src";
import { createScopedReflector } from "../../src/reflector/scoped-reflector";
import type {
	AccessorAnnotation,
	Cardinality as AnnotateCardinality,
	DecoratedClassList,
	DecoratedClassUnique,
	DecoratedItem,
	DecoratedMethodList,
	DecoratedMethodUnique,
	DecoratedPropertyList,
	DecoratedPropertyUnique,
	FieldAnnotation,
	ListMetadataKey,
	MethodAnnotation,
	ScopedReflector,
	UniqueMetadataKey,
} from "../../src";

// @ts-expect-error: legacy factory helper types are not public API
type RemovedDecoratorOptions = import("../../src").Decorator\u004fptions<unknown>;
// @ts-expect-error: legacy factory helper types are not public API
type RemovedMetadata = import("../../src").Metadata\u004ff<unknown>;
// @ts-expect-error: legacy factory helper types are not public API
type RemovedArgs = import("../../src").Args\u004ff<unknown>;
// @ts-expect-error: legacy factory helper types are not public API
type RemovedThis = import("../../src").This\u004ff<unknown>;
// @ts-expect-error: legacy factory helper types are not public API
type RemovedCardinality = import("../../src").Cardinality\u004ff<unknown>;

declare const removedDecoratorOptions: RemovedDecoratorOptions;
declare const removedMetadata: RemovedMetadata;
declare const removedArgs: RemovedArgs;
declare const removedThis: RemovedThis;
declare const removedCardinality: RemovedCardinality;
void removedDecoratorOptions;
void removedMetadata;
void removedArgs;
void removedThis;
void removedCardinality;

interface Meta {
	v: string;
}

class BaseInstance {
	name = "";
}

class Fixture {
	method(): void {}
	field!: string;
	accessor value = 0;
	static health(): void {}
}

const _annotateCardinality: AnnotateCardinality = "many";
void _annotateCardinality;

// =============================================================================
// Annotate public API — handles, mapper inference, selector reads
// =============================================================================

const Route = Annotate.method((method: "GET" | "POST", path: string) => ({ method, path }));
class PublicMethodApi {
	@Route("GET", "/")
	index(): void {}

	// @ts-expect-error: mapper-inferred decorator args reject invalid methods
	@Route("DELETE", "/")
	delete(): void {}
}
void PublicMethodApi;

const UniqueMethod = Annotate.method<string>();
const ListMethod = Annotate.method<string>({ cardinality: "many" });
const UniqueProperty = Annotate.field<string>();
const ListProperty = Annotate.field<string>({ cardinality: "many" });
const UniqueClass = Annotate.class<string>();
const ListClass = Annotate.class<string>({ cardinality: "many" });

const _oneRead: string | undefined = UniqueMethod.read(Fixture).get((fixture) => fixture.method);
void _oneRead;

const _manyRead: readonly string[] = ListMethod.read(Fixture).get((fixture) => fixture.method);
void _manyRead;

// @ts-expect-error: many-cardinality reads return arrays, not scalar metadata
const _manyAsOne: string | undefined = ListMethod.read(Fixture).get((fixture) => fixture.method);
void _manyAsOne;

const _classRead: string | undefined = UniqueClass.read(Fixture).get();
void _classRead;

const _classManyRead: readonly string[] = ListClass.read(Fixture).get();
void _classManyRead;

const _fieldRead: string | undefined = UniqueProperty.read(Fixture).get((fixture) => fixture.field);
void _fieldRead;

const _fieldManyRead: readonly string[] = ListProperty.read(Fixture).get((fixture) => fixture.field);
void _fieldManyRead;

const StaticRoute = Annotate.method<string>();
const _staticRead: string | undefined = StaticRoute.read(Fixture).static.get((fixture) => fixture.health);
void _staticRead;

const TypedMethod = Annotate.method<string>() as MethodAnnotation<string, [string], () => void, Fixture, "one">;
// @ts-expect-error: instance selectors cannot read members missing from the receiver shape
TypedMethod.read(Fixture).get((fixture) => fixture.missing);

// @ts-expect-error: static selectors cannot read members missing from constructor shape
StaticRoute.read(Fixture).static.get((fixture) => fixture.missing);

// =============================================================================
// Annotate target constraints
// =============================================================================

const NumberField = Annotate.field<Meta>() as FieldAnnotation<Meta, [Meta], number, any, "one">;
class NumberFieldOk {
	@NumberField({ v: "ok" })
	count = 0;
}
void NumberFieldOk;

class NumberFieldBad {
	// @ts-expect-error: field decorator constrained to number fields
	@NumberField({ v: "bad" })
	label = "";
}
void NumberFieldBad;

const BaseOnlyMethod = Annotate.method<Meta>() as MethodAnnotation<Meta, [Meta], () => void, BaseInstance, "one">;
class MethodThisOk extends BaseInstance {
	@BaseOnlyMethod({ v: "ok" })
	run(): void {}
}
void MethodThisOk;

class MethodThisBad {
	// @ts-expect-error: method decorator constrained to BaseInstance receivers
	@BaseOnlyMethod({ v: "bad" })
	run(): void {}
}
void MethodThisBad;

const NumberAccessor = Annotate.accessor<Meta>() as AccessorAnnotation<Meta, [Meta], number, any, "one">;
class AccessorOk {
	@NumberAccessor({ v: "ok" })
	accessor count = 0;
}
void AccessorOk;

class AccessorBad {
	// @ts-expect-error: accessor decorator constrained to number accessors
	@NumberAccessor({ v: "bad" })
	accessor label = "";
}
void AccessorBad;

const AsyncOnly = Annotate.method<Meta>() as MethodAnnotation<Meta, [Meta], () => Promise<void>, any, "one">;
class AsyncMethodOk {
	@AsyncOnly({ v: "ok" })
	async run(): Promise<void> {}
}
void AsyncMethodOk;

class AsyncMethodBad {
	// @ts-expect-error: method decorator constrained to async-compatible methods
	@AsyncOnly({ v: "bad" })
	run(): void {}
}
void AsyncMethodBad;

const Labelled = Annotate.method({
	label: "Route",
	args: (method: "GET" | "POST", path: string) => ({ method, path }),
});
class OptionsMapperApi {
	@Labelled("POST", "/users")
	create(): void {}

	// @ts-expect-error: options.args mapper controls decorator call arguments
	@Labelled("PATCH", "/users")
	update(): void {}
}
void OptionsMapperApi;

// =============================================================================
// Interceptor options and context cardinality
// =============================================================================

const OneMethodInterceptor = Annotate.intercept.method<string>({
	wrap: (original, ctx) => {
		const meta: string | undefined = ctx.get(new Fixture());
		void meta;
		return original;
	},
});
void OneMethodInterceptor;

const ManyMethodInterceptor = Annotate.intercept.method<string>({
	cardinality: "many",
	wrap: (original, ctx) => {
		const meta: readonly string[] = ctx.get(new Fixture());
		void meta;
		return original;
	},
});
void ManyMethodInterceptor;

const FieldWithThis = Annotate.intercept.field<Meta, [Meta], number, BaseInstance>({
	init(initial, ctx) {
		const name: string = this.name;
		const meta: Meta | undefined = ctx.get(this);
		void name;
		void meta;
		return initial;
	},
});
void FieldWithThis;

const AccessorHooks = Annotate.intercept.accessor<Meta, [Meta], number>({
	get: (original, ctx) => {
		const meta: Meta | undefined = ctx.get(new Fixture());
		void meta;
		return original;
	},
	set: (original, ctx) => {
		const meta: Meta | undefined = ctx.get(new Fixture());
		void meta;
		return original;
	},
});
void AccessorHooks;

// =============================================================================
// Public handle type aliases
// =============================================================================

const _methodHandle: MethodAnnotation<string, [string], (...args: never[]) => unknown, any, "one"> =
	Annotate.method<string>();
void _methodHandle;

const _fieldHandle: FieldAnnotation<string, [string], string, BaseInstance, "one"> = Annotate.field<string>();
void _fieldHandle;

const _accessorHandle: AccessorAnnotation<string, [string], number, BaseInstance, "one"> = Annotate.accessor<string>();
void _accessorHandle;

// =============================================================================
// Metadata keys and reflect cardinality narrowing
// =============================================================================

const UniqueMethodKey = mintUniqueKey<string>("method");
const ListMethodKey = mintListKey<string>("method-list");
const UniquePropertyKey = mintUniqueKey<string>("property");
const ListPropertyKey = mintListKey<string>("property-list");
const UniqueClassKey = mintUniqueKey<string>("class");
const ListClassKey = mintListKey<string>("class-list");

const _uniqueKey: UniqueMetadataKey<string> = UniqueMethodKey;
void _uniqueKey;

const _listKey: ListMetadataKey<string> = ListMethodKey;
void _listKey;

// @ts-expect-error: list keys are not unique keys
const _listAsUniqueKey: UniqueMetadataKey<string> = ListMethodKey;
void _listAsUniqueKey;

// @ts-expect-error: unique keys are not list keys
const _uniqueAsListKey: ListMetadataKey<string> = UniqueMethodKey;
void _uniqueAsListKey;

const uniqueMethods: DecoratedMethodUnique<string>[] = reflect(Fixture).methods(UniqueMethodKey);
void uniqueMethods;

const listMethods: DecoratedMethodList<string>[] = reflect(Fixture).methods(ListMethodKey);
void listMethods;

// @ts-expect-error: unique key method result is not assignable to DecoratedMethodList[]
const _uniqueAsListMethods: DecoratedMethodList<string>[] = reflect(Fixture).methods(UniqueMethodKey);
void _uniqueAsListMethods;

// @ts-expect-error: list key method result is not assignable to DecoratedMethodUnique[]
const _listAsUniqueMethods: DecoratedMethodUnique<string>[] = reflect(Fixture).methods(ListMethodKey);
void _listAsUniqueMethods;

const uniqueProps: DecoratedPropertyUnique<string>[] = reflect(Fixture).properties(UniquePropertyKey);
void uniqueProps;

const listProps: DecoratedPropertyList<string>[] = reflect(Fixture).properties(ListPropertyKey);
void listProps;

// @ts-expect-error: unique key property result is not assignable to DecoratedPropertyList[]
const _uniqueAsListProps: DecoratedPropertyList<string>[] = reflect(Fixture).properties(UniquePropertyKey);
void _uniqueAsListProps;

// @ts-expect-error: list key property result is not assignable to DecoratedPropertyUnique[]
const _listAsUniqueProps: DecoratedPropertyUnique<string>[] = reflect(Fixture).properties(ListPropertyKey);
void _listAsUniqueProps;

const uniqueClass: DecoratedClassUnique<string> | undefined = reflect(Fixture).class(UniqueClassKey);
void uniqueClass;

const listClass: DecoratedClassList<string> | undefined = reflect(Fixture).class(ListClassKey);
void listClass;

// @ts-expect-error: unique key class result is not assignable to DecoratedClassList | undefined
const _uniqueAsListClass: DecoratedClassList<string> | undefined = reflect(Fixture).class(UniqueClassKey);
void _uniqueAsListClass;

// @ts-expect-error: list key class result is not assignable to DecoratedClassUnique | undefined
const _listAsUniqueClass: DecoratedClassUnique<string> | undefined = reflect(Fixture).class(ListClassKey);
void _listAsUniqueClass;

const fixtureReflector = reflect(Fixture);
const readAll = fixtureReflector.all.bind(fixtureReflector);

const uniqueAll: DecoratedItem<string, "unique">[] = readAll(UniqueMethodKey);
void uniqueAll;

const listAll: DecoratedItem<string, "list">[] = readAll(ListMethodKey);
void listAll;

// @ts-expect-error: unique key all() result is not assignable to DecoratedItem<string, "list">[]
const _uniqueAllAsList: DecoratedItem<string, "list">[] = readAll(UniqueMethodKey);
void _uniqueAllAsList;

// @ts-expect-error: list key all() result is not assignable to DecoratedItem<string, "unique">[]
const _listAllAsUnique: DecoratedItem<string, "unique">[] = readAll(ListMethodKey);
void _listAllAsUnique;

// =============================================================================
// createScopedReflector inference
// =============================================================================

const ctor = Fixture;

const scopedFor = createScopedReflector;
const scopedUnique: ScopedReflector<string, "unique"> = scopedFor(ctor, UniqueMethodKey);
void scopedUnique;

const scopedList: ScopedReflector<string, "list"> = scopedFor(ctor, ListMethodKey);
void scopedList;

const scopedUniqueMethodEntries: DecoratedMethodUnique<string>[] = scopedUnique.methods();
void scopedUniqueMethodEntries;

const scopedListMethodEntries: DecoratedMethodList<string>[] = scopedList.methods();
void scopedListMethodEntries;

// @ts-expect-error: unique-scoped methods() not assignable to DecoratedMethodList[]
const _scopedUniqueMethodsAsList: DecoratedMethodList<string>[] = scopedUnique.methods();
void _scopedUniqueMethodsAsList;

// @ts-expect-error: list-scoped methods() not assignable to DecoratedMethodUnique[]
const _scopedListMethodsAsUnique: DecoratedMethodUnique<string>[] = scopedList.methods();
void _scopedListMethodsAsUnique;
