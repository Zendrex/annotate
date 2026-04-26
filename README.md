# @zendrex/annotate

**Typed decorators with built-in reflection. Zero dependencies. No `reflect-metadata`.**

Define a decorator factory and get back a decorator that knows its arguments, its target, its metadata, and how to reflect over the classes that use it. Arguments and metadata flow through generics, so reads return typed values instead of `any`.

```bash
bun add @zendrex/annotate
```

Works with npm, pnpm, yarn. Requires TypeScript 5.2+ and Node ≥ 20.4 (or any runtime with `Symbol.metadata`). Built on TC39 Stage-3 decorators. No `experimentalDecorators`, no `reflect-metadata` shim, no `emitDecoratorMetadata`.

**Stage-3 note:** the standard has no parameter decorator. If you rely on that from the legacy world, you will need a different design or the old compiler flags. Annotate only targets Stage-3.

On older runtimes that lack `Symbol.metadata` (Node < 22.3, some browsers, embedded engines) import the shim once at your application entry, before any decorated class loads:

```ts
import "@zendrex/annotate/shim";
```

The shim installs `Symbol.for("Symbol.metadata")` onto the `Symbol` global so the decorator transformer and Annotate's runtime agree on the slot. It is a no-op when the engine already provides `Symbol.metadata`. Most modern transformers (TS ≥5.2, esbuild ≥0.21 with `target: esnext`, swc with `decoratorVersion: "2022-03"`, Babel with `@babel/plugin-proposal-decorators` `version: "2023-05"`) write to the same slot.

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "experimentalDecorators": false,
    "emitDecoratorMetadata": false
  }
}
```

## Why this exists

If you have built a controller framework, ORM, DI container, or validator, you have probably hit these problems:

- `**reflect-metadata` is a global string-keyed bag.** Two libraries that pick the same key clobber each other. No scoping, no isolation, no compile-time check.
- **Decorator arguments are untyped at the read site.** You store `{ path: "/" }` and read it back as `any`. The type checker does not help.
- **Validation is your problem.** Want to reject a bad shape at decoration time? Write the throw yourself. Require a base class? Same.
- **Stage-2 vs Stage-3 split the ecosystem.** Most existing libraries assume the legacy `experimentalDecorators` ABI and break under the standard one.
- **Reading metadata is awkward.** `Reflect.getMetadata("custom:route", target, "list")` uses a string key with no autocomplete, no type, and no scope.

Annotate gives every factory its own metadata key. Arguments, stored value, target class, and `this` inside methods all flow through generics. Reading metadata returns typed entries. Validation, scoping, and reflection are first-class.

## A decorator in three lines (sort of)

```typescript
import { decorate } from "@zendrex/annotate";

const Get = decorate.method<string>();

class Users {
  @Get("/")      list() {}
  @Get("/:id")   show() {}
}

for (const { name, metadata } of Get.reader(Users).methods()) {
  console.log(metadata, "→", name);
}
// "/"     → list
// "/:id"  → show
```

Three pieces: factory, decorator, reflect. The factory generates a typed key. The decorator stores values under that key. The reader returns them, scoped and typed, on demand.

## What you can build

### An HTTP router

Class metadata, method metadata, composed arguments, a wrapping interceptor, and reflection wiring it up:

```typescript
import { decorate, intercept } from "@zendrex/annotate";

const Controller = decorate.class<string>();

const Route = decorate.method({
  compose: (method: "GET" | "POST", path: string) => ({ method, path }),
});

const Log = intercept.method<string>({
  intercept: (fn, readMetadata, ctx) => function (this: any, ...args: any[]) {
    console.log(`→ ${readMetadata(this)[0]}/${String(ctx.name)}`);
    return fn.apply(this, args);
  },
});

@Controller("/users")
class Users {
  @Route("GET",  "/")     @Log("users") list()   {}
  @Route("POST", "/")     @Log("users") create() {}
  @Route("GET",  "/:id")  @Log("users") show()   {}
}

const prefix = Controller.firstOrThrow(Users);
for (const { name, metadata } of Route.reader(Users).methods()) {
  app.on(metadata.method, prefix + metadata.path, name);
}
```

### Schema-validated entity fields

Validators run early. For class and static-member decorators they fire during class evaluation; for instance fields and methods they run on the first `new` (or first reflective read), well before any traffic. `requireInstanceOf` is part of the same chain, so non-conforming hosts are rejected on the same path.

```typescript
class Entity {}

const Field = decorate.property<{ type: "string" | "int"; min?: number }>({
  requireInstanceOf: Entity,
  validate: ({ type, min }, { memberName }) => {
    if (type === "int" && min !== undefined && !Number.isInteger(min)) {
      throw new Error(`${String(memberName)}: min must be an integer`);
    }
  },
});

class User extends Entity {
  @Field({ type: "string" })       name!: string;
  @Field({ type: "int", min: 0 })  age!: number;
}

Field.reader(User).properties();
```

Apply `@Field` to a non-`Entity` class and you get `InvalidDecorationTargetError` on the first `new` (or the first reflective read) — well before the property is actually used.

### Method interceptors read metadata fresh at call time

An interceptor's `readMetadata(instance)` returns the values stored under its own factory's key. The read happens at invocation time, not decoration time, so the interceptor always sees the fully committed list — independent of where the interceptor sits in a decorator stack.

```typescript
const Audit = intercept.method<string>({
  intercept: (original, readMetadata) => function (this: any, ...args: any[]) {
    const tags = readMetadata(this);
    log(tags, args);
    return original.apply(this, args);
  },
});
```

### Specialized factories that share a key

`.derive()` returns a child factory writing to the same metadata key as the parent. Narrow the target type, chain another validator, or relabel for clearer errors. Reflection through the parent still sees every child entry.

```typescript
const IntField = Field.derive({
  name: "IntField",
  validate: ({ type }, { memberName }) => {
    if (type !== "int") {
      throw new Error(`${String(memberName)}: IntField requires type "int"`);
    }
  },
});

class Account extends Entity {
  @IntField({ type: "int", min: 0 }) balance!: number;
}

// Same key: Field.reader() sees every @IntField entry too.
// The parent validator runs first, then the child.
Field.reader(Account).properties();
```

## Core ideas

### Factories own their keys

A factory bundles a decorator, a `MetadataKey`, and a typed reader. No string keys. No collisions. Two libraries can both define a `Route` factory and they will never see each other's data.

### Reflection is scoped

`factory.reader(ClassOrInstance)` returns a reader bound to that factory's key. You ask the reader questions; the factory's storage answers. There is also an unscoped `reflect()` for tools that hold many keys at once.

### Metadata is lazy

Instance metadata commits on first `new`. Statics commit during class evaluation. Read helpers call `prepare()` automatically, so you only invoke it manually when an external tool walks `Object.getOwnPropertyNames` before any instance exists.

### Failures are typed and early

Validation, base-class requirement, and uniqueness checks all fire well before runtime use: class- and static-member decorators check during class evaluation; instance-member decorators check on the first `new` or reflective read. The errors are domain types you can branch on.

## API surface

### Factories


| Factory                     | Decorates                          |
| --------------------------- | ---------------------------------- |
| `decorate.class<TMeta>`     | classes                            |
| `decorate.method<TMeta>`    | methods                            |
| `decorate.property<TMeta>`  | class fields                       |
| `intercept.method<TMeta>`   | methods (wraps the implementation) |
| `intercept.accessor<TMeta>` | `accessor` fields (wraps get/set)  |


Every factory accepts trailing generics to constrain the target: method signature, field type, `this` shape, or `instanceof` bound. Mismatches fail at compile time.

### Shared options

```typescript
{
  compose?:           (...args) => TMeta,  // fold arguments into stored value
  validate?:          (meta, ctx) => void, // throw to reject at decoration
  requireInstanceOf?: AnyConstructor,      // enclosing class must extend this
  name?:              string,              // label in error messages
}
```

### Factory surface

```typescript
Route.key                                  // UniqueMetadataKey<TMeta> (branded symbol)
Route.reader(target).methods()             // DecoratedMethodUnique<TMeta>[]
Route.first(target, name)                  // TMeta | undefined
Route.firstOrThrow(target, name)           // TMeta, throws on missing
Route.all(target, name)                    // MetadataArray<TMeta>, capped at length ≤ 1
Route.has(target, name)                    // boolean, never throws
Route.hasOwn(target, name)                 // ignores inherited
Route.derive({ ... })                      // child factory, same key, narrowed
```

Class factories drop the `name` argument. Interceptors expose the same surface.

### Unique vs list cardinality

Every factory defaults to **unique** cardinality: at most one metadata value per decoration site. A second application of the same factory to the same method or class throws `DuplicateMetadataError` at decoration time. The `.key` on a unique factory is typed `UniqueMetadataKey<TMeta>`, and the reader's `methods()` / `properties()` / `class()` return entries where `metadata` is `TMeta` directly.

Each factory's `.key` is branded with its cardinality (`UniqueMetadataKey<TMeta>` or `ListMetadataKey<TMeta>`). Branded keys flow through every read API and select the matching return shape automatically, there is no untyped fallback.

Use the `.list` sibling on the factory namespace when multiple values must stack on the same site:

```typescript
import { decorate } from "@zendrex/annotate";

// unique (default): at most one value per method
const Role = decorate.method<string>();

// list: many values per method, accumulated in application order
const Tag = decorate.method.list<string>();

class Api {
  @Role("admin") @Tag("public") @Tag("internal") get() {}
}

// Role.key is UniqueMetadataKey<string> → metadata: string
for (const { name, metadata } of Role.reader(Api).methods()) {
  console.log(name, metadata); // "get", "admin"
}

// Tag.key is ListMetadataKey<string> → metadata: readonly string[]
// Stage-3 applies decorators inner-first, so the closest @Tag stores first.
for (const { name, metadata } of Tag.reader(Api).methods()) {
  console.log(name, metadata); // "get", ["internal", "public"]
}
```

The same `.list` sibling is available on every namespace entry: `decorate.class.list`, `decorate.property.list`, `intercept.method.list`, `intercept.accessor.list`.

### Unscoped reflect

```typescript
import { reflect } from "@zendrex/annotate";

reflect(Users).methods(Route.key);
```

Pass keys per call. Useful when a consumer holds many factories and wants to traverse them generically.

Keys must be branded: pass a factory's `.key`, or a symbol minted via `mintUniqueKey<TMeta>(name?)` / `mintListKey<TMeta>(name?)`. The cardinality brand on the key narrows the result; `methods(uniqueKey)` returns `DecoratedMethodUnique<TMeta>[]` (scalar `metadata`); `methods(listKey)` returns `DecoratedMethodList<TMeta>[]` (`readonly TMeta[]`). Raw `Symbol(...)` is rejected at compile time and at runtime with `UnregisteredMetadataKeyError`.

```typescript
import { mintListKey, reflect } from "@zendrex/annotate";

const TAGS = mintListKey<string>("tags");
// ... append values via a custom store / decorator that uses TAGS ...
reflect(Users).methods(TAGS); // metadata: readonly string[]
```

### Type helpers

```typescript
import type { MetadataOf, ArgsOf, ThisOf } from "@zendrex/annotate";

type M = MetadataOf<typeof Route>;  // { method: "GET" | "POST"; path: string }
type A = ArgsOf<typeof Route>;      // ["GET" | "POST", string]
```

### prepare

Instance metadata commits on first `new`. Statics commit during class evaluation. Reader helpers auto-prepare. Call `prepare(Ctor)` manually only when an external tool needs the flush before any instance exists.

## Errors

Every domain error extends `AnnotateError` and carries `code`, `target`, `key?`, `kind?`, `memberName?`.


| Class                          | `code`              | When                                                                                                                 |
| ------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DuplicateMetadataError`       | `"duplicate"`       | unique factory applied twice to the same slot                                                                        |
| `UnregisteredClassError`       | `"unregistered"`    | `reflect()` called on a class with no annotate metadata anywhere on its prototype chain                              |
| `UnregisteredMetadataKeyError` | `"unregisteredKey"` | store append targets a key absent from the cardinality registry (key minted outside `mintUniqueKey` / `mintListKey`) |
| `InvalidDecorationTargetError` | `"invalidTarget"`   | `requireInstanceOf` rejects the host class; carries `requiredBase`                                                   |
| `ValidationError`              | `"validation"`      | a `validate` hook threw; original error attached as `Error.cause`                                                    |
| `MissingMetadataError`         | `"missing"`         | `firstOrThrow` found nothing                                                                                         |


Invalid factory configuration (e.g. `intercept.accessor` with neither `onGet` nor `onSet`) throws plain `TypeError`.

## Status

v1.0 alpha. Rewritten on Stage-3 decorators. The public API is stable in shape but may change in detail before 1.0.0.

## License

MIT