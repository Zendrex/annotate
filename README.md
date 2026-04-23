# @zendrex/annotate

A modern decorator and metadata system for TypeScript. Create typed decorators with built-in reflection.

> **v1.0.0-alpha.0 — Stage-3 decorators.** This is a major rewrite. v0.x callers will not work without code changes. See [CHANGELOG.md](./CHANGELOG.md) for the full migration guide.

## Installation

```bash
# Bun
bun add @zendrex/annotate

# npm
npm install @zendrex/annotate

# Yarn
yarn add @zendrex/annotate

# pnpm
pnpm add @zendrex/annotate
```

Requires TypeScript 5.2+ with Stage-3 decorators. No `reflect-metadata` or `experimentalDecorators` needed.

```jsonc
{
  "compilerOptions": {
    "experimentalDecorators": false,
    "emitDecoratorMetadata": false,
    "target": "ES2022",
    "useDefineForClassFields": true
  }
}
```

Runtime floor: Node ≥ 20.4 for native `Symbol.metadata`, or a transpiler-provided shim.

## Quick Start

```typescript
import { createClassDecorator, createMethodDecorator } from "@zendrex/annotate";

// Create typed decorators
const Controller = createClassDecorator<string>();
const Route = createMethodDecorator<{ path: string; method: string }>();

// Apply them
@Controller("users")
class UserController {
  @Route({ path: "/", method: "GET" })
  list() {}

  @Route({ path: "/:id", method: "GET" })
  get() {}
}

// Reflect on the metadata
const routes = Route.reflect(UserController).methods();

for (const route of routes) {
  console.log(route.name, route.metadata);
}
// list [{ path: "/", method: "GET" }]
// get [{ path: "/:id", method: "GET" }]
```

## Core Concepts

### Decorator Factories

Each factory creates a typed decorator with built-in reflection. Options use a
single `DecoratorOptions` shape: optional `compose`, `name` (for error
prefixes), and `unique` (class / method / property / interceptors; not on
parameters).

```typescript
import {
  createClassDecorator,
  createMethodDecorator,
  createPropertyDecorator,
} from "@zendrex/annotate";

const Tag = createClassDecorator<string>();
const Route = createMethodDecorator<string>();
const Column = createPropertyDecorator<string>();
```

### Constraint generics

Each factory accepts an optional third generic that constrains what the decorator can be applied to. If the constraint fails, the compiler rejects the decoration at the call site — no runtime check needed.

```typescript
const IsNumber = createPropertyDecorator<{ kind: "number" }, [], number>();

class Account {
  @IsNumber()
  balance!: number;  // ✓ ok

  @IsNumber()
  // @ts-expect-error: number-bound rejects boolean
  active!: boolean;
}
```

The same mechanism applies to `createClassDecorator<M, Args, TInstance>` (rejects non-subclass classes), `createMethodDecorator<M, Args, TMethod>` (e.g., async-only), and `createAccessorInterceptor<M, Args, TValue>` (the accessor's declared value type).

Known limitations: `any`-typed fields always pass (standard TS loophole); optional fields like `x?: number` do **not** widen the constraint, so `@IsNumber() x?: number` still compiles.

### Compose

Pass `compose` to transform multiple decorator arguments into metadata:

```typescript
const Route = createMethodDecorator({
  compose: (path: string, method: "GET" | "POST") => ({ path, method }),
});

class Api {
  @Route("/users", "GET")
  getUsers() {}
}
```

### Reflection

Factories expose `key`, `reflect(target)` (class constructor or instance),
scalar lookups, and `applied` / `appliedOwn` where applicable. Use
`Factory.reflect(ctorOrInstance).methods()` (and the same for `properties()`)
for collections; `methodsSingular` / `propertiesSingular` live on
`ScopedReflector` only.

```typescript
const Column = createPropertyDecorator<{ type: string; nullable?: boolean }>();

class User {
  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "int", nullable: true })
  age!: number;
}

const columns = Column.reflect(User).properties();

for (const col of columns) {
  console.log(col.name, col.metadata);
}
```

### Property injection

```typescript
import { createPropertyDecorator } from "@zendrex/annotate";

const Inject = createPropertyDecorator<string>();

class UserService {
  @Inject("database")
  db!: Database;

  @Inject("logger")
  logger!: Logger;
}

const deps = Inject.reflect(UserService).properties();
const instance = new UserService();
for (const dep of deps) {
  (instance as any)[dep.name] = container.get(dep.metadata[0]);
}
```

### Class metadata scalars

Use `metadata(target)` (or `requireMetadata(target)`) for the first value, with
inheritance along the class constructor chain. `applied` / `appliedOwn` report
array presence; use `appliedOwn` to ignore inherited class metadata on
subclasses.

```typescript
const Controller = createClassDecorator<string>();

@Controller("users")
class UserController {}

class AdminController extends UserController {}

Controller.metadata(AdminController);  // => "users" (inherited)
Controller.applied(AdminController);   // => true
Controller.appliedOwn(AdminController); // => false when only the parent is decorated
```

### Singular method and property lists

```typescript
const EventHandler = createMethodDecorator<EventHandlerMeta>();

class Component {
  @EventHandler({ event: "click" })
  onClick() {}
}

for (const { name, metadata } of EventHandler.reflect(Component).methodsSingular()) {
  bind(name, metadata);
}

EventHandler.metadata(Component, "onClick");
EventHandler.requireMetadata(Component, "onClick");
```

### `reflect()`

`reflect(ctorOrInstance)` returns an unscoped `Reflector` (pass a
`MetadataKey` into each call). The same constructor resolution applies as for
`factory.reflect`: you may pass a class, or an object whose
`object.constructor` is a valid class constructor. Plain `{}`, `Object`, arrow
functions, and other invalid targets throw `TypeError` with stable message
prefixes (see source tests for patterns).

### materialize(ctor)

Instance-member metadata registers lazily — for a class with only instance decorators (no class decorator, no static-decorated members), the metadata stores are empty until the first `new Ctor()`. Most APIs on the factory auto-materialize for you (`Factory.reflect`, `Factory.applied`, `Factory.metadata`, and `reflect(ctor)` from the barrel all call `materialize(ctor)` internally). Call `materialize(ctor)` directly only if you need an explicit eager-flush — for example, before publishing the class to a DI container that introspects via `Object.getOwnPropertyNames`.

```typescript
import { materialize, createPropertyDecorator } from "@zendrex/annotate";

const Field = createPropertyDecorator<string>();

class User {
  @Field("varchar")
  name!: string;
}

materialize(User);  // instance-member metadata now committed
```

## Interceptors

```typescript
import { createMethodInterceptor } from "@zendrex/annotate";

const Timed = createMethodInterceptor<string>({
  intercept: (original, readMetadata, context) =>
    function (this: unknown, ...args: unknown[]) {
      const start = performance.now();
      const result = original.apply(this, args);
      console.log(`${String(context.name)} took ${performance.now() - start}ms — tags: ${readMetadata(this as object).join(",")}`);
      return result;
    } as typeof original,
});
```

`InterceptorContext` carries `name` (member key), `static` (boolean), and `kind` (`"method" | "accessor"`).

**Accessor interceptors** wrap `accessor foo: T;` (and `get`/`set` pairs) — not plain class fields. `createAccessorInterceptor` requires at least one of `onGet` / `onSet`; calling it with neither throws `TypeError`. To attach metadata to a plain field without interception, use `createPropertyDecorator`.

```typescript
import { createAccessorInterceptor } from "@zendrex/annotate";

const Trace = createAccessorInterceptor<string>({
  onGet: (original, readMetadata) =>
    function (this: unknown) {
      console.log("read", readMetadata(this as object));
      return original.call(this);
    },
});

class Box {
  @Trace("box")
  accessor value: string = "v";
}
```

## Errors

- **`AnnotateError`** — abstract base. Subclasses carry `code` (`"missing" | "duplicate"`), `kind` (`DecoratedKind`), `target` (always a constructor), and optional `memberName`.
- **`DuplicateMetadataError`** — thrown when a `unique: true` decorator is applied twice.
- **`UnregisteredClassError`** — thrown by `reflect(ctor).methods(...)` / `.properties(...)` / `.class(...)` if `ctor` was never decorated with a member/class decorator from this library. Use `Factory.applied(ctor, name)` instead — it never throws and returns `false` on the unregistered path.
- Invalid factory options (e.g. an accessor interceptor with neither `onGet` nor `onSet`) throw `TypeError`, not `AnnotateError`.

## API summary

- **Class factory:** `key`, `reflect`, `metadata`, `requireMetadata`, `applied`, `appliedOwn`
- **Method / property (and `createAccessorInterceptor`):** `key`, `reflect`, `metadata(target, name)`, `requireMetadata`, `applied`, `appliedOwn`

## License

MIT
