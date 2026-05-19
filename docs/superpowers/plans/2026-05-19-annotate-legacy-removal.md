# Annotate Legacy Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the legacy factory/decorator API so source, tests, and exports use only `Annotate.*` for decorator creation.

**Architecture:** Keep the existing metadata storage, reflection, preparation, and selector-reader runtime. Replace the legacy `src/factories` public model with Annotate-internal target builders under `src/annotate`, using `label`, `args`, `requires`, `wrap`, `get`, `set`, and `init` vocabulary. Convert tests to exercise `Annotate.*` handles and retain low-level `reflect`, `prepare`, and metadata-key coverage.

**Tech Stack:** TypeScript 6, Bun test runner, Stage-3 decorators, `tsdown`, Ultracite/Biome formatting.

---

## File Structure

- Delete: `src/legacy.ts`
- Delete after imports are gone: `src/factories/accessor-interceptor.ts`
- Delete after imports are gone: `src/factories/class-decorator.ts`
- Delete after imports are gone: `src/factories/field-interceptor.ts`
- Delete after imports are gone: `src/factories/method-decorator.ts`
- Delete after imports are gone: `src/factories/method-interceptor.ts`
- Delete after imports are gone: `src/factories/property-decorator.ts`
- Delete after imports are gone: `src/factories/shared.ts`
- Delete after imports are gone: `src/factories/types.ts`
- Move/rename: `src/factories/validator-chain.ts` -> `src/annotate/validation.ts`
- Move/rename: `src/factories/validator-types.ts` -> `src/annotate/validation-types.ts`
- Create: `src/annotate/internal-types.ts`
- Create: `src/annotate/target-shared.ts`
- Create: `src/annotate/targets/class.ts`
- Create: `src/annotate/targets/method.ts`
- Create: `src/annotate/targets/field.ts`
- Create: `src/annotate/targets/accessor.ts`
- Modify: `src/annotate/builders.ts`
- Modify: `src/annotate/normalize-input.ts`
- Modify: `src/annotate/types.ts`
- Modify: `src/annotate/index.ts`
- Modify: `src/index.ts`
- Modify: `src/errors.ts`
- Modify tests under `tests/integration`, `tests/unit`, and `tests/fixtures`
- Modify release notes in `.changeset/stage3-alpha.md`

## Task 1: Add Failing Public-Surface Guards

**Files:**
- Modify: `tests/unit/annotate.test.ts`
- Modify: `tests/unit/types.test-d.ts`

- [ ] **Step 1: Add runtime export guards**

Append this test to `tests/unit/annotate.test.ts` inside the existing `describe("Annotate", ...)` block:

```ts
test("public root does not expose removed legacy decorator namespaces", async () => {
	const PublicApi = await import("../../src");

	expect("decorate" in PublicApi).toBe(false);
	expect("intercept" in PublicApi).toBe(false);
	expect("createMethodDecorator" in PublicApi).toBe(false);
	expect("createPropertyDecorator" in PublicApi).toBe(false);
});
```

- [ ] **Step 2: Add type-level removed-export guards**

In `tests/unit/types.test-d.ts`, remove these imports:

```ts
import { createAccessorInterceptor, createAccessorListInterceptor } from "../../src/factories/accessor-interceptor";
import { createClassDecorator, createClassListDecorator } from "../../src/factories/class-decorator";
import { createMethodDecorator, createMethodListDecorator } from "../../src/factories/method-decorator";
import { createMethodListInterceptor } from "../../src/factories/method-interceptor";
import { createPropertyDecorator, createPropertyListDecorator } from "../../src/factories/property-decorator";
import type { ArgsOf, CardinalityOf, MetadataOf, ThisOf } from "../../src/factories/types";
```

Add these assertions below the root imports:

```ts
// @ts-expect-error: legacy factory helper types are not public API
import type { DecoratorOptions } from "../../src";
// @ts-expect-error: legacy factory helper types are not public API
import type { MetadataOf } from "../../src";
// @ts-expect-error: legacy factory helper types are not public API
import type { ArgsOf } from "../../src";
// @ts-expect-error: legacy factory helper types are not public API
import type { ThisOf } from "../../src";
// @ts-expect-error: legacy factory helper types are not public API
import type { CardinalityOf } from "../../src";
```

Remove the entire section headed `factories/types — MetadataOf / ArgsOf / ThisOf slot wiring`. Replace the cross-section factories with Annotate handles:

```ts
const UniqueMethod = Annotate.method<string>();
const ListMethod = Annotate.method<string>({ cardinality: "many" });
const UniqueProperty = Annotate.field<string>();
const ListProperty = Annotate.field<string>({ cardinality: "many" });
const UniqueClass = Annotate.class<string>();
const ListClass = Annotate.class<string>({ cardinality: "many" });
```

- [ ] **Step 3: Run type checks to confirm the new guard fails before implementation**

Run:

```bash
bun run check-types
```

Expected: FAIL with unused `@ts-expect-error` directives for root-exported legacy helper types and unresolved local references from the removed factory type section.

- [ ] **Step 4: Commit the failing guard**

Run:

```bash
git add tests/unit/annotate.test.ts tests/unit/types.test-d.ts
git commit -m "test: guard annotate public surface"
```

## Task 2: Convert Shared Fixtures And Integration Tests To Annotate

**Files:**
- Modify: `tests/fixtures/decorators.ts`
- Modify: `tests/integration/bun-multi-field.test.ts`
- Modify: `tests/integration/cross-class-isolation.test.ts`
- Modify: `tests/integration/interceptor-timing.test.ts`
- Modify: `tests/integration/introspection-semantics.test.ts`
- Modify: `tests/integration/materialization.test.ts`
- Modify: `tests/integration/mixed-cardinality.test.ts`
- Modify: `tests/integration/reflect-instance.test.ts`

- [ ] **Step 1: Replace shared fixture factories**

Replace `tests/fixtures/decorators.ts` with:

```ts
import { Annotate } from "../../src";

export const ClassTag = Annotate.class<string>();
export const MethodRoute = Annotate.method<string>();
export const PropertyColumn = Annotate.field<string>();
```

- [ ] **Step 2: Convert the interceptor timing integration test**

Replace the factory imports in `tests/integration/interceptor-timing.test.ts` with:

```ts
import { Annotate } from "../../src";
```

Use Annotate handles and selector reads in the test body:

```ts
const Sibling = Annotate.method<string>();
const seen: string[][] = [];
const Bottom = Annotate.intercept.method<string>({
	wrap: (original, ctx) =>
		function (this: object, ...args: unknown[]) {
			seen.push(ctx.get(this) ?? []);
			return original.call(this, ...args);
		} as typeof original,
});

class X {
	@Sibling("from-sibling")
	@Bottom("from-bottom")
	run(): void {}
}

const x = new X();
x.run();
expect(seen).toEqual([["from-bottom"]]);
expect(Sibling.read(X).get((target) => target.run)).toBe("from-sibling");
```

- [ ] **Step 3: Convert field-interceptor integration tests**

In `tests/integration/bun-multi-field.test.ts`, replace `createFieldInterceptor` with:

```ts
const TestField = Annotate.intercept.field<TagMeta, [string], string>({
	args: (tag) => ({ tag }),
	init(this: object, initial, ctx) {
		const metadata = ctx.get(this as object);
		return `${initial}:${metadata?.tag ?? "missing"}`;
	},
});
```

Use `TestField.read(ClassName).get((target) => target.fieldName)` for scalar metadata assertions.

- [ ] **Step 4: Convert metadata integration tests**

For each integration file listed above, use this replacement pattern:

```ts
const Tag = Annotate.class<string>();
const Route = Annotate.method<string>();
const Field = Annotate.field<string>();
const Tags = Annotate.method<string>({ cardinality: "many" });
```

Replace legacy reads:

```ts
Tag.first(Target)
Route.first(Target, "run")
Field.has(Target, "name")
Field.reader(Target).properties()
```

with Annotate reads:

```ts
Tag.read(Target).get()
Route.read(Target).get((target) => target.run)
Field.read(Target).get((target) => target.name) !== undefined
Field.read(Target).fields()
```

- [ ] **Step 5: Run integration tests to expose remaining legacy references**

Run:

```bash
bun run test:integration
```

Expected: FAIL only where unit tests or source files still import `src/factories/*`; integration tests no longer import those modules.

- [ ] **Step 6: Commit the integration conversion**

Run:

```bash
git add tests/fixtures/decorators.ts tests/integration
git commit -m "test: convert integration coverage to annotate"
```

## Task 3: Replace Factory Unit Tests With Annotate Unit Tests

**Files:**
- Delete: `tests/unit/factories/accessor-interceptor.test.ts`
- Delete: `tests/unit/factories/accessor-list-interceptor.test.ts`
- Delete: `tests/unit/factories/class-decorator.test.ts`
- Delete: `tests/unit/factories/class-list-decorator.test.ts`
- Delete: `tests/unit/factories/derive.test.ts`
- Delete: `tests/unit/factories/field-interceptor.test.ts`
- Delete: `tests/unit/factories/field-list-interceptor.test.ts`
- Delete: `tests/unit/factories/method-decorator.test.ts`
- Delete: `tests/unit/factories/method-interceptor.test.ts`
- Delete: `tests/unit/factories/method-list-decorator.test.ts`
- Delete: `tests/unit/factories/method-list-interceptor.test.ts`
- Delete: `tests/unit/factories/property-decorator.test.ts`
- Delete: `tests/unit/factories/property-list-decorator.test.ts`
- Delete: `tests/unit/factories/shared.test.ts`
- Modify: `tests/unit/annotate.test.ts`
- Create: `tests/unit/annotate-interceptors.test.ts`
- Create: `tests/unit/annotate-validation.test.ts`

- [ ] **Step 1: Add direct Annotate coverage for former class/method/field tests**

Add these tests to `tests/unit/annotate.test.ts`:

```ts
test("one-cardinality annotations reject duplicate application at the same site", () => {
	const Tag = Annotate.class<string>({ label: "Tag" });

	expect(() => {
		@Tag("outer")
		@Tag("inner")
		class Duplicate {}
		void Duplicate;
	}).toThrow("Duplicate metadata for @Tag on Duplicate");
});

test("many-cardinality class annotations preserve inherited most-derived-first reads", () => {
	const Tag = Annotate.class<string>({ cardinality: "many" });

	@Tag("base")
	class Base {}

	@Tag("child")
	class Child extends Base {}

	expect(Tag.read(Child).get()).toEqual(["child", "base"]);
	expect(Tag.read(Child).entries()).toEqual([
		{ kind: "class", name: "Child", target: Child, metadata: ["child", "base"] },
	]);
});

test("argument mapper options infer decorator arguments", () => {
	const Route = Annotate.method({
		label: "Route",
		args: (method: "GET" | "POST", path: string) => ({ method, path }),
	});

	class Api {
		@Route("GET", "/users")
		list(): void {}
	}

	expect(Route.read(Api).get((api) => api.list)).toEqual({ method: "GET", path: "/users" });
});
```

- [ ] **Step 2: Add Annotate interceptor unit coverage**

Create `tests/unit/annotate-interceptors.test.ts`:

```ts
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test fixture methods */

import { describe, expect, test } from "bun:test";

import { Annotate } from "../../src";

describe("Annotate interceptors", () => {
	test("accessor interceptors wrap get and set hooks", () => {
		const events: unknown[] = [];
		const Watch = Annotate.intercept.accessor<string, [string], string>({
			args: (label) => label,
			get: (original, ctx) =>
				function (this: object) {
					events.push(["get", ctx.get(this)]);
					return original.call(this);
				},
			set: (original, ctx) =>
				function (this: object, value: string) {
					events.push(["set", ctx.get(this), value]);
					return original.call(this, value);
				},
		});

		class Box {
			@Watch("value")
			accessor value = "a";
		}

		const box = new Box();
		box.value = "b";
		expect(box.value).toBe("b");
		expect(events).toEqual([
			["set", "value", "b"],
			["get", "value"],
		]);
	});

	test("field interceptors replace instance and static field values", () => {
		const Default = Annotate.intercept.field<string, [string], string>({
			args: (label) => label,
			init(this: object, initial, ctx) {
				return `${initial}:${ctx.get(this) ?? "missing"}`;
			},
		});

		class Box {
			@Default("instance")
			label = "box";

			@Default("static")
			static mode = "mode";
		}

		expect(new Box().label).toBe("box:instance");
		expect(Box.mode).toBe("mode:static");
	});
});
```

- [ ] **Step 3: Add Annotate validation coverage**

Create `tests/unit/annotate-validation.test.ts`:

```ts
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test fixture methods */

import { describe, expect, test } from "bun:test";

import { Annotate, InvalidDecorationTargetError, ValidationError } from "../../src";

describe("Annotate validation", () => {
	test("requires rejects classes outside the required base", () => {
		class Base {}
		const Controller = Annotate.class<string>({ label: "Controller", requires: Base });

		expect(() => {
			@Controller("bad")
			class Subject {}
			void Subject;
		}).toThrow(InvalidDecorationTargetError);
	});

	test("validate receives mapped metadata", () => {
		const Route = Annotate.method({
			label: "Route",
			args: (path: string) => ({ path }),
			validate(route) {
				if (!route.path.startsWith("/")) {
					throw "path must start with /";
				}
			},
		});

		expect(() => {
			class Api {
				@Route("bad")
				index(): void {}
			}
			new Api();
		}).toThrow(ValidationError);
	});
});
```

- [ ] **Step 4: Delete legacy factory test files**

Run:

```bash
git rm tests/unit/factories/accessor-interceptor.test.ts tests/unit/factories/accessor-list-interceptor.test.ts tests/unit/factories/class-decorator.test.ts tests/unit/factories/class-list-decorator.test.ts tests/unit/factories/derive.test.ts tests/unit/factories/field-interceptor.test.ts tests/unit/factories/field-list-interceptor.test.ts tests/unit/factories/method-decorator.test.ts tests/unit/factories/method-interceptor.test.ts tests/unit/factories/method-list-decorator.test.ts tests/unit/factories/method-list-interceptor.test.ts tests/unit/factories/property-decorator.test.ts tests/unit/factories/property-list-decorator.test.ts tests/unit/factories/shared.test.ts
```

- [ ] **Step 5: Run focused Annotate tests**

Run:

```bash
bun test tests/unit/annotate.test.ts tests/unit/annotate-interceptors.test.ts tests/unit/annotate-validation.test.ts
```

Expected: FAIL until source internals are renamed and factory imports are removed.

- [ ] **Step 6: Commit the unit-test conversion**

Run:

```bash
git add tests/unit/annotate.test.ts tests/unit/annotate-interceptors.test.ts tests/unit/annotate-validation.test.ts
git add -u tests/unit/factories
git commit -m "test: replace factory tests with annotate coverage"
```

## Task 4: Rename Internal Options And Validation Types

**Files:**
- Move/modify: `src/factories/validator-types.ts` -> `src/annotate/validation-types.ts`
- Move/modify: `src/factories/validator-chain.ts` -> `src/annotate/validation.ts`
- Create: `src/annotate/internal-types.ts`
- Modify: `src/annotate/types.ts`
- Modify: `src/annotate/index.ts`
- Modify: `src/errors.ts`

- [ ] **Step 1: Move validation type definitions**

Move the file:

```bash
git mv src/factories/validator-types.ts src/annotate/validation-types.ts
```

Keep the public `ValidateContext` export from `src/annotate/index.ts`:

```ts
export type { ValidateContext } from "./validation-types";
```

- [ ] **Step 2: Move and rename validation chain inputs**

Move the validator chain:

```bash
git mv src/factories/validator-chain.ts src/annotate/validation.ts
```

Change the `buildValidatorChain` option shape to:

```ts
export function buildValidatorChain<TMeta>(
	options: { validate?: ValidatorFn<TMeta>; requires?: AnyConstructor } | undefined,
	label: string,
	key: MetadataKey
): ValidatorFn<TMeta>[] | undefined {
	const requiredBase = options?.requires;
	const userValidate = options?.validate;
	if (!(requiredBase || userValidate)) {
		return;
	}
	const chain: ValidatorFn<TMeta>[] = [];
	if (requiredBase) {
		chain.push((_meta, context) => {
			if (context.target === requiredBase || context.target.prototype instanceof requiredBase) {
				return;
			}
			throw new InvalidDecorationTargetError({
				label,
				target: context.target,
				requiredBase,
				kind: context.kind,
				memberName: context.memberName,
				key,
			});
		});
	}
	if (userValidate) {
		chain.push(wrapUserValidate(userValidate, label, key));
	}
	return chain;
}
```

- [ ] **Step 3: Add Annotate-internal option types**

Create `src/annotate/internal-types.ts`:

```ts
import type { Cardinality as StorageCardinality } from "../metadata/types";
import type { AnyConstructor } from "../reflector/types";
import type { Cardinality } from "./types";
import type { ValidatorFn } from "./validation-types";

export type AnyFn = (...args: never[]) => unknown;

export type AnyClass<TInstance> = abstract new (...args: never[]) => TInstance;

export interface InternalInterceptorContext {
	kind: "method" | "accessor" | "field";
	name: string | symbol;
	static: boolean;
}

type ArgsRequirement<TMeta, TArgs extends unknown[]> = [TArgs] extends [[TMeta]]
	? { args?: (...args: TArgs) => TMeta }
	: { args: (...args: TArgs) => TMeta };

export type InternalAnnotationOptions<TMeta, TArgs extends unknown[] = [TMeta]> = {
	label?: string;
	requires?: AnyConstructor;
	validate?: ValidatorFn<TMeta>;
} & ArgsRequirement<TMeta, TArgs>;

export type InternalCardinalityOf<TCard extends Cardinality> = TCard extends "many" ? "list" : "unique";
export type PublicCardinalityOf<TCard extends StorageCardinality> = TCard extends "list" ? "many" : "one";

export interface MethodHookRefs<TMeta, TMethod extends AnyFn> {
	wrap: (
		original: TMethod,
		readMetadata: (instance: object) => TMeta[],
		context: InternalInterceptorContext
	) => TMethod;
}

export interface AccessorHookRefs<TMeta, TValue> {
	get?: (
		original: () => TValue,
		readMetadata: (instance: object) => TMeta[],
		context: InternalInterceptorContext
	) => () => TValue;
	set?: (
		original: (value: TValue) => void,
		readMetadata: (instance: object) => TMeta[],
		context: InternalInterceptorContext
	) => (value: TValue) => void;
}

export interface FieldHookRefs<TMeta, TField> {
	init: (
		initial: TField,
		readMetadata: (instance: object) => TMeta[],
		context: InternalInterceptorContext
	) => TField;
}
```

- [ ] **Step 4: Update public type imports**

In `src/annotate/types.ts`, import from `./validation-types` instead of `../factories/validator-types`:

```ts
import type { ValidatorFn } from "./validation-types";
```

Update `FieldInterceptorOptions` so field initializers can read their own metadata through `ctx.get(this)`:

```ts
export type FieldInterceptorOptions<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TField = unknown,
	TThis = unknown,
	TCard extends Cardinality = "one",
> = BuilderOptionsInputBase<TMeta, TArgs, TCard> & {
	init: (this: TThis, initial: TField, context: PublicInterceptorContext<TMeta, TCard>) => TField;
};
```

Update `src/annotate/index.ts` field interceptor overloads to pass `TThis` into `FieldInterceptorOptions<TMeta, TArgs, TField, TThis, TCard>`.

In `src/index.ts`, remove all type exports from `./factories/types` and keep only current public Annotate, error, metadata key, and reflector types.

- [ ] **Step 5: Update error wording comments**

In `src/errors.ts`, replace the comment:

```ts
/** Decorated type does not extend the factory's `requireInstanceOf` base. */
```

with:

```ts
/** Decorated type does not extend the annotation's `requires` base. */
```

- [ ] **Step 6: Run type check**

Run:

```bash
bun run check-types
```

Expected: FAIL because source files still import from `src/factories/*`.

- [ ] **Step 7: Commit the validation/type rename**

Run:

```bash
git add src/annotate/internal-types.ts src/annotate/validation.ts src/annotate/validation-types.ts src/annotate/types.ts src/annotate/index.ts src/index.ts src/errors.ts
git add -u src/factories/validator-chain.ts src/factories/validator-types.ts
git commit -m "refactor: rename annotate validation internals"
```

## Task 5: Move Target Builders Under Annotate

**Files:**
- Create: `src/annotate/target-shared.ts`
- Create: `src/annotate/targets/class.ts`
- Create: `src/annotate/targets/method.ts`
- Create: `src/annotate/targets/field.ts`
- Create: `src/annotate/targets/accessor.ts`
- Modify: `src/annotate/builders.ts`
- Modify: `src/annotate/normalize-input.ts`

- [ ] **Step 1: Create target shared helpers using Annotate names**

Create `src/annotate/target-shared.ts` by moving the non-reader parts of `src/factories/shared.ts`. Rename the option and mapper helpers to:

```ts
export function mapArgs<TMeta>(args: [TMeta]): TMeta;
export function mapArgs<TMeta, TArgs extends unknown[]>(
	args: TArgs,
	mapper: ((...args: TArgs) => TMeta) | undefined
): TMeta;
export function mapArgs<TMeta, TArgs extends unknown[]>(
	args: TArgs,
	mapper?: (...args: TArgs) => TMeta
): TMeta {
	return mapper ? mapper(...args) : (args[0] as TMeta);
}

export function labelFor(label: string | undefined, key: MetadataKey): string {
	return label ?? keyDisplayName(key);
}

export function prepareTargetBuilder<TMeta, TArgs extends unknown[]>(
	key: MetadataKey<TMeta>,
	options: InternalAnnotationOptions<TMeta, TArgs> | undefined
): {
	argsMapper: ((...args: TArgs) => TMeta) | undefined;
	label: string;
	validators: ValidatorFn<TMeta>[] | undefined;
} {
	const { args: argsMapper, label } = options ?? {};
	const displayLabel = labelFor(label, key);
	const validators = buildValidatorChain<TMeta>(options, displayLabel, key);
	return { argsMapper, label: displayLabel, validators };
}
```

Keep `commitDecoration`, `emitMemberDecoration`, and `createMemberMetadataReader` with updated imports from `src/annotate/validation`.

- [ ] **Step 2: Create the class target builder**

Create `src/annotate/targets/class.ts`:

```ts
import { appendClassMeta } from "../../metadata/stores/class-meta-store";
import { commitDecoration, mapArgs, prepareTargetBuilder } from "../target-shared";
import type { Cardinality, Ctor, MetadataKey } from "../../metadata/types";
import type { AnyConstructor } from "../../reflector/types";
import type { AnyClass, InternalAnnotationOptions } from "../internal-types";

export type ClassTargetDecorator<TMeta, TArgs extends unknown[], TInstance> = (
	...args: TArgs
) => <T extends AnyClass<TInstance>>(value: T, context: ClassDecoratorContext<T>) => void;

export function buildClassTarget<TMeta, TArgs extends unknown[], TInstance, TCard extends Cardinality = "unique">(
	key: MetadataKey<TMeta, TCard>,
	options: InternalAnnotationOptions<TMeta, TArgs> | undefined
): ClassTargetDecorator<TMeta, TArgs, TInstance> {
	const { argsMapper, validators } = prepareTargetBuilder<TMeta, TArgs>(key, options);

	return (...args: TArgs) =>
		<T extends AnyClass<TInstance>>(value: T, context: ClassDecoratorContext<T>): void => {
			const meta = mapArgs(args, argsMapper);
			commitDecoration({
				ctor: value as unknown as Ctor,
				correlation: context.metadata,
				meta,
				validators,
				validationContext: {
					target: value as unknown as AnyConstructor,
					kind: "class",
					static: false,
				},
				append: () => {
					appendClassMeta(value, key, meta);
				},
			});
		};
}
```

- [ ] **Step 3: Create method, field, and accessor target builders**

Move the current `buildMethodFactory`, `buildPropertyFactory`, `buildFieldFactory`, and `buildAccessorFactory` bodies into the new target files. Use these exported names:

```ts
export function buildMethodTarget(...)
export function buildFieldTarget(...)
export function buildFieldInterceptorTarget(...)
export function buildAccessorTarget(...)
```

Use these vocabulary replacements inside the moved code:

```ts
compose(args, composeFn) -> mapArgs(args, argsMapper)
hookRefs.intercept -> hookRefs.wrap
hookRefs.onGet -> hookRefs.get
hookRefs.onSet -> hookRefs.set
hookRefs.onInit -> hookRefs.init
InterceptorContext -> InternalInterceptorContext
DecoratorOptions -> InternalAnnotationOptions
```

Return the decorator function directly. Do not attach `key`, `reader`, `first`, `firstOrThrow`, `has`, `hasOwn`, `all`, or `derive`.

In `src/annotate/builders.ts`, preserve the field initializer receiver when adapting the public hook to the internal hook:

```ts
const hookRefs: FieldHookRefs<TMeta, TField> = {
	init: function (this: TThis, initial, readMetadata, context) {
		return options.init.call(
			this,
			initial,
			publicContext({ kind: "field", name: context.name, static: context.static }, readMetadata, cardinality)
		);
	},
};
```

- [ ] **Step 4: Update builder imports**

In `src/annotate/builders.ts`, replace factory imports:

```ts
import { buildAccessorFactory } from "../factories/accessor-interceptor";
import { buildClassFactory } from "../factories/class-decorator";
import { buildFieldFactory } from "../factories/field-interceptor";
import { buildMethodFactory } from "../factories/method-decorator";
import { buildPropertyFactory } from "../factories/property-decorator";
```

with target imports:

```ts
import { buildAccessorTarget } from "./targets/accessor";
import { buildClassTarget } from "./targets/class";
import { buildFieldInterceptorTarget, buildFieldTarget } from "./targets/field";
import { buildMethodTarget } from "./targets/method";
```

Update each call site:

```ts
buildClassFactory(...) -> buildClassTarget(...)
buildMethodFactory(...) -> buildMethodTarget(...)
buildPropertyFactory(..., "field") -> buildFieldTarget(...)
buildAccessorFactory(..., {}, "accessor") -> buildAccessorTarget(...)
buildFieldFactory(..., hookRefs, "field") -> buildFieldInterceptorTarget(...)
```

- [ ] **Step 5: Rename normalized option output**

In `src/annotate/normalize-input.ts`, rename `LegacyOptionsInput` to `BuilderOptionsInput`, `toLegacyOptions` to `toAnnotationOptions`, and `options.name`/`options.requireInstanceOf` mappings to `options.label`/`options.requires`.

The returned shape must be:

```ts
export interface NormalizedBuilderInput<TMeta, TArgs extends unknown[], TCard extends Cardinality> {
	cardinality: TCard;
	key: MetadataKey<TMeta, InternalCardinalityOf<TCard>>;
	options: InternalAnnotationOptions<TMeta, TArgs> | undefined;
}
```

- [ ] **Step 6: Run focused build/type checks**

Run:

```bash
bun run check-types
```

Expected: FAIL only for tests still importing `src/factories/*` or for missing target-builder imports.

- [ ] **Step 7: Commit target-builder move**

Run:

```bash
git add src/annotate/builders.ts src/annotate/normalize-input.ts src/annotate/target-shared.ts src/annotate/targets
git commit -m "refactor: move annotate target builders"
```

## Task 6: Delete Legacy Factory Modules And Finish Test Imports

**Files:**
- Delete: `src/legacy.ts`
- Delete: `src/factories`
- Modify: `tests/unit/reflector/reflect-cache.test.ts`
- Modify: `tests/unit/reflector/reflector.test.ts`
- Modify: `tests/unit/reflector/scoped-reflector.test.ts`
- Modify: `tests/unit/runtime/prepare.test.ts`
- Modify: `tests/unit/errors.test.ts`
- Modify: `tests/unit/types.test-d.ts`

- [ ] **Step 1: Replace reflector test decorators with Annotate handles**

Use this pattern in reflector tests:

```ts
const Tag = Annotate.class<string>();
const Route = Annotate.method<string>();
const Field = Annotate.field<string>();
const Tags = Annotate.class<string>({ cardinality: "many" });
```

Keep low-level reflector assertions by passing Annotate-owned keys only if the public handle intentionally exposes no key. When a test needs a low-level key, mint one directly and use a tiny local Stage-3 decorator:

```ts
const Key = mintUniqueKey<string>("route");
const Route = (value: string) => (_method: unknown, context: ClassMethodDecoratorContext) => {
	context.addInitializer(function (this: unknown) {
		appendMemberMeta(this as never, Key, context.name, value, Symbol("route"), {
			static: context.static,
			kind: "method",
		});
	});
};
```

Prefer Annotate handles for user-facing behavior and direct metadata store helpers only for low-level reflector tests.

- [ ] **Step 2: Remove remaining factory imports**

Run:

```bash
rg -n "src/factories|create[A-Z].*(Decorator|Interceptor)|create.*List|\\.derive\\(|\\.reader\\(|\\.first\\(|\\.all\\(|\\.has\\(" tests src
```

Expected before edits: matches in tests and deleted source paths. Edit each match to `Annotate.*`, `.read(...)`, `reflect(...)`, or direct low-level metadata-store setup.

- [ ] **Step 3: Delete legacy files**

Run:

```bash
git rm src/legacy.ts
git rm -r src/factories
```

- [ ] **Step 4: Run source/test search**

Run:

```bash
rg -n "src/factories|src/legacy|create[A-Z].*(Decorator|Interceptor)|create.*List|\\bDecoratorOptions\\b|\\bDecorated.*Factory\\b|\\bMetadataOf\\b|\\bArgsOf\\b|\\bThisOf\\b|\\bCardinalityOf\\b|\\bcompose\\b|\\brequireInstanceOf\\b|\\bonGet\\b|\\bonSet\\b|\\bonInit\\b|\\.derive\\(|\\.reader\\(|\\.first\\(|\\.all\\(|\\.has\\(" src tests
```

Expected: no matches, except `has(` calls on ordinary `Map`/`Set` values when the match is not a decorator-reader API.

- [ ] **Step 5: Run unit tests**

Run:

```bash
bun run test:unit
```

Expected: PASS after all imports and assertions are converted.

- [ ] **Step 6: Commit deletion of legacy modules**

Run:

```bash
git add src tests
git commit -m "refactor: delete legacy factory api"
```

## Task 7: Update Release Notes And Documentation References

**Files:**
- Modify: `.changeset/stage3-alpha.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md` only if this branch keeps generated changelog edits checked in

- [ ] **Step 1: Make the changeset wording match Annotate-only internals**

In `.changeset/stage3-alpha.md`, keep the migration table but update misleading present-tense internals. Replace:

```md
- `InvalidDecorationTargetError` (code `"invalidTarget"`) — thrown when
  `requireInstanceOf` rejects.
```

with:

```md
- `InvalidDecorationTargetError` (code `"invalidTarget"`) — thrown when
  `requires` rejects the decorated host class.
```

- [ ] **Step 2: Check README public API references**

Run:

```bash
rg -n "decorate\\.|intercept\\.|create[A-Z].*(Decorator|Interceptor)|\\.list|compose|requireInstanceOf|onGet|onSet|onInit|DecoratorOptions|MetadataOf|ArgsOf|ThisOf|CardinalityOf" README.md
```

Expected: no matches. The string `Annotate.intercept` is valid and must remain.

- [ ] **Step 3: Check migration docs separately**

Run:

```bash
rg -n "decorate\\.|intercept\\.|create[A-Z].*(Decorator|Interceptor)|\\.list|compose|requireInstanceOf|onGet|onSet|onInit|DecoratorOptions|MetadataOf|ArgsOf|ThisOf|CardinalityOf" .changeset CHANGELOG.md docs/superpowers/specs
```

Expected: matches are allowed only in migration tables, release history, or the approved design spec.

- [ ] **Step 4: Commit documentation cleanup**

Run:

```bash
git add README.md .changeset/stage3-alpha.md CHANGELOG.md
git commit -m "docs: align release notes with annotate api"
```

## Task 8: Final Verification

**Files:**
- Modify only files needed to fix failures found by the commands below.

- [ ] **Step 1: Run type checking**

Run:

```bash
bun run check-types
```

Expected: PASS.

- [ ] **Step 2: Run unit tests**

Run:

```bash
bun run test:unit
```

Expected: PASS.

- [ ] **Step 3: Run integration tests**

Run:

```bash
bun run test:integration
```

Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run:

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```bash
bun run build
```

Expected: PASS and `dist` contains no `legacy` chunk or export.

- [ ] **Step 6: Run lint/check**

Run:

```bash
bun run check
```

Expected: PASS. If this command rewrites files through the checker, inspect the diff before committing.

- [ ] **Step 7: Run final legacy search**

Run:

```bash
rg -n "src/factories|src/legacy|create[A-Z].*(Decorator|Interceptor)|create.*List|\\bDecoratorOptions\\b|\\bDecorated.*Factory\\b|\\bMetadataOf\\b|\\bArgsOf\\b|\\bThisOf\\b|\\bCardinalityOf\\b|\\bcompose\\b|\\brequireInstanceOf\\b|\\bonGet\\b|\\bonSet\\b|\\bonInit\\b|\\.derive\\(|\\.reader\\(|\\.first\\(|\\.all\\(|\\.has\\(" src tests README.md
```

Expected: no matches, except ordinary `Map.has`/`Set.has` calls after manual review.

- [ ] **Step 8: Commit final fixes**

Run:

```bash
git add src tests README.md .changeset/stage3-alpha.md CHANGELOG.md
git commit -m "chore: verify annotate legacy removal"
```

## Self-Review

- Spec coverage: Tasks 1, 6, and 8 cover deleted public compatibility surface. Tasks 4 and 5 cover internal vocabulary. Tasks 2 and 3 cover test conversion to `Annotate.*`. Task 7 covers docs and release notes.
- Placeholder scan: The plan contains concrete paths, code snippets, commands, and expected outcomes for every task.
- Type consistency: Public options use `label`, `args`, `requires`, `cardinality`, `wrap`, `get`, `set`, and `init`. Internal storage cardinality stays `"unique" | "list"` behind `InternalCardinalityOf`.
