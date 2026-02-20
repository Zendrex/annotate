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
const routes = Route.methods(UserController);

for (const route of routes) {
  console.log(route.name, route.metadata);
}
// list [{ path: "/", method: "GET" }]
// get [{ path: "/:id", method: "GET" }]
```

## Core Concepts

### Decorator Factories

Each factory creates a typed decorator with built-in reflection:

```typescript
import {
  createClassDecorator,
  createMethodDecorator,
  createPropertyDecorator,
  createParameterDecorator,
} from "@zendrex/annotate";

// Simple decorators pass through their argument as metadata
const Tag = createClassDecorator<string>();
const Route = createMethodDecorator<string>();
const Column = createPropertyDecorator<string>();
const Param = createParameterDecorator<string>();
```

### Compose Functions

For richer metadata, pass a compose function to transform decorator arguments:

```typescript
const Route = createMethodDecorator((path: string, method: "GET" | "POST") => ({
  path,
  method,
}));

class Api {
  @Route("/users", "GET")
  getUsers() {}
}

// Metadata is { path: "/users", method: "GET" }
```

### Reflection

Every decorator factory includes reflection methods:

```typescript
const Column = createPropertyDecorator<{ type: string; nullable?: boolean }>();

class User {
  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "int", nullable: true })
  age!: number;
}

// Get all decorated properties
const columns = Column.properties(User);

for (const col of columns) {
  console.log(col.name, col.metadata);
}
// name [{ type: "varchar" }]
// age [{ type: "int", nullable: true }]
```

### Property Injection

Property decorators can mark fields for dependency injection:

```typescript
import { createPropertyDecorator } from "@zendrex/annotate";

const Inject = createPropertyDecorator<string>();

class UserService {
  @Inject("database")
  db!: Database;

  @Inject("logger")
  logger!: Logger;
}

// Reflect and resolve
const deps = Inject.properties(UserService);
// => [{ kind: "property", name: "db", metadata: ["database"] },
//     { kind: "property", name: "logger", metadata: ["logger"] }]

const instance = new UserService();
for (const dep of deps) {
  (instance as any)[dep.name] = container.get(dep.metadata[0]);
}
```

### General Reflection

Use `reflect()` when you need to query multiple decorator types on a single class:

```typescript
import { reflect } from "@zendrex/annotate";

const reflector = reflect(UserController);

// Query by decorator key
const routes = reflector.methods(Route.key);
const columns = reflector.properties(Column.key);
const params = reflector.parameters(Param.key);
```

## Interceptors

Interceptors wrap the original method or property with custom behavior:

```typescript
import { createMethodInterceptor } from "@zendrex/annotate";

const Timed = createMethodInterceptor<string>({
  interceptor: (original, metadata, ctx) =>
    function (...args) {
      const start = performance.now();
      const result = original.apply(this, args);
      console.log(`${String(ctx.propertyKey)} took ${performance.now() - start}ms`);
      return result;
    },
});

class Service {
  @Timed("database")
  fetchData() {
    // ...
  }
}
```

Property interceptors can hook into get/set operations:

```typescript
import { createPropertyInterceptor } from "@zendrex/annotate";

const Observable = createPropertyInterceptor<string>({
  onSet: (original, metadata, ctx) =>
    function (value) {
      console.log(`${String(ctx.propertyKey)} changed to ${value}`);
      original.call(this, value);
    },
});

class Store {
  @Observable("count")
  count = 0;
}
```

## API Reference

### Decorator Factories

| Function | Creates | Reflection Method |
|----------|---------|-------------------|
| `createClassDecorator<T>()` | Class decorator | `.class(Target)` |
| `createMethodDecorator<T>()` | Method decorator | `.methods(Target)` |
| `createPropertyDecorator<T>()` | Property decorator | `.properties(Target)` |
| `createParameterDecorator<T>()` | Parameter decorator | `.parameters(Target)` |
| `createMethodInterceptor<T>(opts)` | Method interceptor | `.methods(Target)` |
| `createPropertyInterceptor<T>(opts)` | Property interceptor | `.properties(Target)` |

### Reflection Results

Each reflection method returns an array of decorated items:

```typescript
interface DecoratedMethod<T> {
  kind: "method";
  name: string | symbol;
  metadata: T[];
  target: Function;
}

interface DecoratedProperty<T> {
  kind: "property";
  name: string | symbol;
  metadata: T[];
}

interface DecoratedParameter<T> {
  kind: "parameter";
  name: string | symbol;
  metadata: T[];
  parameterIndex: number;
}
```

## License

MIT

