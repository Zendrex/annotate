# @zendrex/annotate

Typed decorators with built-in reflection. TC39 Stage-3. Zero dependencies. No `reflect-metadata`.

```bash
bun add @zendrex/annotate
```

Works with npm, pnpm, yarn. TypeScript 5.2+. Node ≥ 20.4 (or a transpiler that shims `Symbol.metadata`).

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

## A decorator in three lines

```typescript
import { decorate } from "@zendrex/annotate";

const Get = decorate.method<string>();

class Users {
  @Get("/")      list() {}
  @Get("/:id")   show() {}
}

for (const { name, metadata } of Get.reader(Users).methodsScalar()) {
  console.log(metadata, "→", name);
}
// "/"     → list
// "/:id"  → show
```

Three pieces: factory → decorator → reflect.

## Why

- **Typed end to end.** Arguments, stored metadata, the class, and `this` inside methods all flow through factory generics. Misuse fails at compile time.
- **Scoped reflection.** `factory.reader(ClassOrInstance)` returns a reader bound to that factory's key. No globals, no string keys.
- **Composable.** `.derive()` returns a child factory sharing the parent's metadata key. Narrow the target type, chain another validator, or relabel for errors. Reflection through the parent still sees child entries.
- **Lazy.** Instance metadata commits on first `new`; statics commit immediately. No walking on every read.

## HTTP router in ~20 lines

Class metadata, method metadata, composed arguments, a wrapping interceptor, and reflection wiring it up:

```typescript
import { decorate, intercept } from "@zendrex/annotate";

const Controller = decorate.class<string>();

const Route = decorate.method({
  compose: (method: "GET" | "POST", path: string) => ({ method, path }),
});

const Log = intercept.method<string>({
  intercept: (fn, tag, ctx) => function (this: any, ...args: any[]) {
    console.log(`→ ${tag(this)[0]}/${String(ctx.name)}`);
    return fn.apply(this, args);
  },
});

@Controller("/users")
class Users {
  @Route("GET",  "/")     @Log("users") list()   {}
  @Route("POST", "/")     @Log("users") create() {}
  @Route("GET",  "/:id")  @Log("users") show()   {}
}

// Wire to any router.
const prefix = Controller.firstOrThrow(Users);
for (const { name, metadata } of Route.reader(Users).methodsScalar()) {
  app.on(metadata.method, prefix + metadata.path, name);
}
```

## Validated, scoped fields

`validate` and `requireInstanceOf` both run at decoration time. `validate` rejects bad arguments; `requireInstanceOf` rejects host classes that do not extend the required base.

```typescript
import { decorate } from "@zendrex/annotate";

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
  @Field({ type: "string" })        name!: string;
  @Field({ type: "int", min: 0 })   age!: number;
}

Field.reader(User).properties();
```

Applying `@Field` to a class that does not extend `Entity` throws `InvalidDecorationTargetError` at decoration time, not at runtime.

## Extending a factory

`.derive()` returns a child factory that writes to the *same metadata key* as the parent:

| Option | Behavior on `.derive()` |
|---|---|
| `requireInstanceOf` | Child overrides parent. Falls back to parent's when omitted. |
| `validate` | Chains after the parent validator. Parent runs first, then child. |
| `name` | Relabels the child in error messages. |
| `compose`, `unique` | Inherited from the parent. Not overridable, so the stored shape stays consistent across the chain. |

Pass type generics if you need to narrow further: `.derive<TField, TThis>(...)` constrains the child's field type and `this` shape.

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
  @IntField({ type: "int", min: 0 })  balance!: number;
}

// Same key: Field.reader() sees every @IntField entry too.
// Parent's int-min validator still runs before the child's check.
Field.reader(Account).properties();
```

## API

### Factories

| Factory | For |
|---|---|
| `decorate.class<TMeta>` | classes |
| `decorate.method<TMeta>` | methods |
| `decorate.property<TMeta>` | class fields |
| `intercept.method<TMeta>` | methods (wraps) |
| `intercept.accessor<TMeta>` | `accessor` fields |

Every factory takes optional trailing generics to constrain the target: method signature, field type, `this` shape, or `instanceof` bound. Mismatches fail at compile time.

### Shared options

```typescript
{
  compose?:           (...args) => TMeta,  // fold args into stored value
  validate?:          (meta, ctx) => void, // throw to reject at decoration
  requireInstanceOf?: AnyConstructor,      // enclosing class must extend this
  unique?:            boolean,             // replace on re-apply instead of append
  name?:              string,              // label in error messages
}
```

### Factory surface

```typescript
Route.key                                  // MetadataKey (symbol)
Route.reader(target).methodsScalar()       // DecoratedMethodScalar<TMeta>[]
Route.reader(target).methods()             // DecoratedMethod<TMeta>[]
Route.first(target, name)                  // TMeta | undefined
Route.firstOrThrow(target, name)           // TMeta, throws on missing
Route.all(target, name)                    // MetadataArray<TMeta>, empty if not applied
Route.has(target, name)                    // boolean, never throws
Route.hasOwn(target, name)                 // boolean, ignores inherited
Route.derive({ ... })                      // new factory, same key, narrowed
```

Class factories drop `name`; interceptors and `reader()` mirror the same shape.

### Unscoped reflect

```typescript
import { reflect } from "@zendrex/annotate";

reflect(Users).methods(Route.key);
```

Pass keys per-call. Useful when the consumer holds many factories.

### Type helpers

```typescript
import type { MetadataOf, ArgsOf, ThisOf } from "@zendrex/annotate";

type M = MetadataOf<typeof Route>;  // { method: "GET" | "POST"; path: string }
type A = ArgsOf<typeof Route>;      // ["GET" | "POST", string]
```

### prepare

Instance metadata commits on first `new`. All factory helpers auto-materialize on read. Call `prepare(Ctor)` directly only when something else (a DI container scanning `Object.getOwnPropertyNames`) needs the flush first.

## Errors

All domain errors extend `AnnotateError` and carry `code`, `target`, `kind?`, `memberName?`.

| Class | `code` | When |
|---|---|---|
| `DuplicateMetadataError` | `"duplicate"` | `unique: true` factory applied twice |
| `UnregisteredClassError` | `"unregistered"` | `reflect()` on a class with no annotate metadata anywhere on its chain |
| `InvalidDecorationTargetError` | `"invalidTarget"` | `requireInstanceOf` rejects; carries `requiredBase` |
| `ValidationError` | `"validation"` | `validate` hook threw; original on `Error.cause` |
| `AnnotateError` | `"missing"` | `firstOrThrow` found no value |

Invalid factory options (e.g. accessor interceptor with neither `onGet` nor `onSet`) throw `TypeError`.

## v1.0 alpha

Major rewrite on Stage-3 decorators. API is unstable until 1.0.0.

## License

MIT
