# @zendrex/annotate

**Typed Stage-3 decorators with scoped metadata reads. Zero dependencies. No `reflect-metadata`.**

`@zendrex/annotate` gives decorator authors one handle that creates the decorator and reads the metadata back with the right type.

```bash
bun add @zendrex/annotate
```

Requires TypeScript 5.2+ and a Stage-3 decorator transform. Use `experimentalDecorators: false`; legacy TypeScript decorators and parameter decorators are not supported.

On runtimes without native `Symbol.metadata`, import the shim once before decorated classes load:

```ts
import "@zendrex/annotate/shim";
```

## Basic Use

```ts
import { Annotate } from "@zendrex/annotate";

const Route = Annotate.method((method: "GET" | "POST", path: string) => ({ method, path }));

class Users {
  @Route("GET", "/")
  list() {}
}

Route.read(Users).get((users) => users.list);
// { method: "GET", path: "/" }

Route.read(Users).methods();
// [{ kind: "method", name: "list", static: false, metadata: { method: "GET", path: "/" } }]
```

Every annotation handle owns an internal collision-proof symbol key. String labels are optional diagnostics, not identity:

```ts
const Role = Annotate.method<string>({ label: "Role" });
```

## Builders

```ts
Annotate.class(...)
Annotate.method(...)
Annotate.field(...)
Annotate.accessor(...)
```

Direct metadata form:

```ts
const Controller = Annotate.class<string>();
const Column = Annotate.field<{ type: "text" | "int" }>();
```

Argument mapper form:

```ts
const Route = Annotate.method((method: "GET" | "POST", path: string) => ({ method, path }));
```

Options form:

```ts
const Route = Annotate.method({
  label: "Route",
  args: (method: "GET" | "POST", path: string) => ({ method, path }),
  validate: (route) => {
    if (!route.path.startsWith("/")) {
      throw new Error("path must start with /");
    }
  },
});
```

Use `requires` to restrict the host class:

```ts
class ControllerBase {}

const Route = Annotate.method({
  requires: ControllerBase,
  args: (method: "GET" | "POST", path: string) => ({ method, path }),
});
```

## Reading

Class annotations read without selectors:

```ts
const Controller = Annotate.class<string>();

@Controller("users")
class Users {}

Controller.read(Users).get(); // string | undefined
```

Member annotations use typed selectors instead of string names:

```ts
Route.read(Users).get((users) => users.list);
Route.read(Users).static.get((users) => users.health);
```

Selectors must synchronously read exactly one public member. Calling a method, reading no member, or reading multiple members throws `InvalidSelectorError`.

Collection helpers return inherited metadata most-derived-first:

```ts
Route.read(Users).entries();
Route.read(Users).methods();
Column.read(Users).fields();
Watched.read(Users).accessors();
```

Entries include `kind`, `name`, `static`, and `metadata`, so framework code can use ordinary array operations:

```ts
const staticRoutes = Route.read(Users)
  .methods()
  .filter((route) => route.static);
```

## Cardinality

Annotations default to one value per decoration site:

```ts
const Role = Annotate.method<string>();
Role.read(Users).get((users) => users.list); // string | undefined
```

Use `cardinality: "many"` for repeatable decorators:

```ts
const Tag = Annotate.method<string>({ cardinality: "many" });

class Api {
  @Tag("public")
  @Tag("internal")
  list() {}
}

Tag.read(Api).get((api) => api.list); // readonly string[]
```

Stage-3 decorators apply inner-first, so repeated metadata is stored in application order.

## Interceptors

Interceptors live under `Annotate.intercept`:

```ts
const Log = Annotate.intercept.method<string>({
  label: "Log",
  wrap:
    (original, ctx) =>
    function (this: object, ...args: unknown[]) {
      console.log(ctx.name, ctx.get(this));
      return original.apply(this, args as never);
    },
});
```

Available hooks:

```ts
Annotate.intercept.method({ wrap: (original, ctx) => original });
Annotate.intercept.accessor({ get: (original, ctx) => original, set: (original, ctx) => original });
Annotate.intercept.field({ init: (initial, ctx) => initial });
```

`ctx.get(instance)` reads this interceptor's metadata on the current member. Its return type follows cardinality: `T | undefined` for `"one"`, `readonly T[]` for `"many"`.

## Low-Level Reflection

The high-level API does not expose metadata keys. The package still exports `reflect`, `prepare`, and branded key helpers for low-level tooling that deliberately manages keys.

```ts
import { mintListKey, reflect } from "@zendrex/annotate";

const Tags = mintListKey<string>("tags");
reflect(Users).methods(Tags);
```

Most applications should prefer `Annotate.*.read(...)`.

## Errors

Every domain error extends `AnnotateError` and carries a stable `code`.

| Class | Code | When |
| --- | --- | --- |
| `DuplicateMetadataError` | `"duplicate"` | one-cardinality annotation applied twice to the same site |
| `InvalidDecorationTargetError` | `"invalidTarget"` | `requires` rejects the host class |
| `InvalidSelectorError` | `"invalidSelector"` | selector does not read exactly one public member |
| `MissingMetadataError` | `"missing"` | low-level throw-on-missing read found nothing |
| `UnregisteredClassError` | `"unregistered"` | low-level `reflect()` query sees no registered metadata |
| `UnregisteredMetadataKeyError` | `"unregisteredKey"` | low-level store receives an unregistered symbol key |
| `ValidationError` | `"validation"` | a `validate` hook threw |

## License

MIT
