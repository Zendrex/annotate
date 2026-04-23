# @zendrex/annotate

A modern decorator and metadata system for TypeScript. Create typed decorators with built-in reflection.

## Installation

```bash
# Bun
bun add @zendrex/annotate reflect-metadata

# npm
npm install @zendrex/annotate reflect-metadata

# Yarn
yarn add @zendrex/annotate reflect-metadata

# pnpm
pnpm add @zendrex/annotate reflect-metadata
```

Requires TypeScript 5.0+ with `experimentalDecorators` and `emitDecoratorMetadata` enabled.

```jsonc
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    // ...other options as needed
  }
}
```

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
  createParameterDecorator,
} from "@zendrex/annotate";

const Tag = createClassDecorator<string>();
const Route = createMethodDecorator<string>();
const Column = createPropertyDecorator<string>();
const Param = createParameterDecorator<string>();
```

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
`Factory.reflect(ctorOrInstance).methods()` (and the same for `properties()`,
`parameters()`) for collections; `methodsSingular` / `propertiesSingular` live
on `ScopedReflector` only.

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

## Interceptors

```typescript
import { createMethodInterceptor } from "@zendrex/annotate";

const Timed = createMethodInterceptor<string>({
  intercept: (original, metadata, ctx) =>
    function (...args) {
      const start = performance.now();
      const result = original.apply(this, args);
      console.log(`${String(ctx.name)} took ${performance.now() - start}ms`);
      return result;
    },
});
```

`InterceptorContext` uses `owner` (declaration object: prototype or
constructor) and `name` (member key), plus `descriptor`.

Property interceptors require at least one of `onGet` / `onSet`. Calling
`createPropertyInterceptor({})` throws `TypeError`.

## `AnnotateError`

Thrown for missing or duplicate (when `unique: true`) metadata. Public fields
include `key`, `kind` (`DecoratedKind`), `code` (`"missing"` | `"duplicate"`),
`target` (always a constructor), and optional `memberName` and `parameterIndex`
for `MISSING` on members or parameters. Invalid factory options (for example
empty property interceptors) use `TypeError`, not `AnnotateError`.

## API summary

- **Class factory:** `key`, `reflect`, `metadata`, `requireMetadata`, `applied`, `appliedOwn`
- **Method / property (and interceptors):** `key`, `reflect`, `metadata(target, name)`, `requireMetadata`, `applied`, `appliedOwn`
- **Parameter factory:** `key`, `reflect`, `metadata(target, index, methodName?)`, `requireMetadata`, `applied`, `appliedOwn` — omit `methodName` for constructor parameters

## License

MIT
