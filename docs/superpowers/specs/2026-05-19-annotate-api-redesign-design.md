# Annotate API Redesign Design

## Status

Draft design captured during brainstorming. This document records the decisions agreed so far and the open areas that still need review before implementation planning.

## Goal

Redesign `@zendrex/annotate` around a clean, type-safe, low-friction API for creating, applying, and reading TypeScript decorators. This is a breaking redesign; the current `decorate.*` and `intercept.*` public APIs are implementation reference points, not compatibility constraints.

## Product Direction

The library should optimize for three users at the same time:

- Decorator authors who define typed annotations and interceptors.
- Decorator consumers who apply annotations without learning decorator internals.
- Framework builders who compose metadata, validation, inheritance, reflection, and interception into higher-level systems.

The primary mental model is:

1. Create an annotation handle.
2. Apply the handle as a decorator.
3. Read typed metadata through the same handle.

## Public Namespace

The canonical public entrypoint is a parent `Annotate` object:

```ts
import { Annotate } from "@zendrex/annotate";
```

Canonical annotation builders:

```ts
Annotate.class(...)
Annotate.method(...)
Annotate.field(...)
Annotate.accessor(...)
```

Canonical interceptor builders:

```ts
Annotate.intercept.method(...)
Annotate.intercept.field(...)
Annotate.intercept.accessor(...)
```

The old `decorate` / `intercept` split is removed from the canonical API. A single parent namespace keeps the library approachable and makes all decorator-related features feel like one system.

## Labels And Identity

Users do not manage metadata keys. Every annotation handle owns an internally minted, collision-proof symbol key.

String labels are optional and diagnostic-only. They improve error messages, debugging output, and documentation, but they are not identity.

No positional string label should be required or encouraged:

```ts
const Role = Annotate.method<string>();
```

Use options when a label is useful:

```ts
const Role = Annotate.method<string>({
	label: "Role",
});
```

The options property is named `label`, not `name`, because `name` sounds like identity.

## Basic Metadata API

If an annotation stores exactly the value passed to the decorator, users supply a generic metadata type:

```ts
const Role = Annotate.method<string>();

class Api {
	@Role("admin")
	index() {}
}
```

The generic is needed only because there is no value at definition time for TypeScript to infer from.

The same pattern applies to classes and fields:

```ts
const Controller = Annotate.class<string>();
const Column = Annotate.field<{ type: "text" | "int" }>();
```

## Argument Mapper API

When the decorator call shape differs from the stored metadata shape, users provide an argument mapper function. TypeScript infers both the decorator argument tuple and the metadata type from the function.

```ts
const Route = Annotate.method((method: "GET" | "POST", path: string) => ({
	method,
	path,
}));

class Api {
	@Route("GET", "/")
	index() {}
}
```

No generic is needed in this form.

## Options API

Configuration is used for advanced behavior. It should not be required for the common path.

The options API supports the same direct metadata and mapper forms:

```ts
const Role = Annotate.method<string>({
	label: "Role",
});
```

```ts
const Route = Annotate.method({
	label: "Route",
	args: (method: "GET" | "POST", path: string) => ({
		method,
		path,
	}),
});
```

The mapper property is named `args`, not `map` or `fromArgs`, because it describes the decorator argument shape directly and reads well in config.

## Cardinality

No separate namespace is exposed for many-cardinality annotations. Users configure cardinality through options only.

Separate builder namespaces are terse but unclear, and they force users to learn a library-specific concept before understanding the behavior.

Cardinality is configured with plain language:

```ts
const Role = Annotate.method<string>();
const Tag = Annotate.method<string>({
	cardinality: "many",
});
```

Default cardinality is `"one"`.

Public cardinality values:

```ts
type Cardinality = "one" | "many";
```

Behavior:

- `"one"` stores at most one value per decoration site.
- `"many"` allows repeated applications and stores values in decoration order.

Read return types follow cardinality:

```ts
Role.read(Api).get((api) => api.index); // string | undefined
Tag.read(Api).get((api) => api.index); // readonly string[]
```

## Reading Metadata

The read API should stay small. It should not expose separate sugar methods for every common operation.

There are two canonical read paths:

1. Use `get` with a typed selector when reading one known class member.
2. Use collection methods and normal array operations when scanning metadata.

Selector reads avoid stringly member names:

```ts
Role.read(Api).get((api) => api.index);
```

Field reads use the same selector shape:

```ts
Column.read(User).get((user) => user.name);
```

Class annotation reads do not need a selector:

```ts
Controller.read(User).get();
```

Static member reads use a small `static` reader namespace so the selector is typed against the constructor instead of the instance:

```ts
Route.read(Api).static.get((api) => api.health);
```

`get` return types are driven by cardinality:

- `"one"` returns `T | undefined`.
- `"many"` returns `readonly T[]`.

Existence checks use normal JavaScript:

```ts
Role.read(Api).get((api) => api.index) !== undefined;
Tag.read(Api).get((api) => api.index).length > 0;
```

Framework builders enumerate collections and compose with `map`, `filter`, and other array methods:

```ts
const routes = Route.read(Api)
	.methods()
	.map((method) => ({
		name: method.name,
		route: method.metadata,
	}));
```

The collection surface is intentionally small:

```ts
const Watched = Annotate.accessor<string>();

Route.read(Api).entries();
Route.read(Api).methods();
Column.read(User).fields();
Watched.read(User).accessors();
```

Collections include inherited metadata by default and preserve the current most-derived-first behavior. Member entries include `kind`, `name`, `static`, and `metadata`, so callers can use ordinary array operations for more specific scans:

```ts
const staticRoutes = Route.read(Api)
	.methods()
	.filter((method) => method.static);
```

The public read surface should not include `first`, `all`, `has`, `byName`, or `hasName`. Name-based reads are not part of the v1 public API. If dynamic access is needed later, it should be considered as a separate low-level API instead of being attached to every annotation handle.

### Selector Semantics

Selectors are type-safe member selectors, not arbitrary predicates.

At runtime, Annotate resolves the selected member by executing the selector against a proxy that records property access. The selector must synchronously read exactly one public property or method:

```ts
Role.read(Api).get((api) => api.index);
Column.read(User).get((user) => user.name);
Route.read(Api).static.get((api) => api.health);
```

Selectors may use symbols:

```ts
const key = Symbol("route");
Route.read(Api).get((api) => api[key]);
```

Invalid selectors throw `InvalidSelectorError`:

```ts
Role.read(Api).get((api) => api.index()); // invalid: invokes the method
Role.read(Api).get((api) => api.a || api.b); // invalid: reads more than one member
Role.read(Api).get(() => undefined); // invalid: reads no member
```

Private fields cannot be selected. Applying Annotate decorators to private members should throw `InvalidDecorationTargetError`; private member decorators are out of scope for v1.

## Interceptors

Interceptors live under `Annotate.intercept` so they remain part of the same mental model.

Method interceptor example:

```ts
const Log = Annotate.intercept.method<string>({
	label: "Log",
	wrap: (original, ctx) =>
		function (...args) {
			ctx.get(this);
			return original.apply(this, args);
		},
});
```

Interceptor hook names should be plain verbs:

```ts
Annotate.intercept.method({
	wrap: (original, ctx) => original,
});

Annotate.intercept.accessor({
	get: (original, ctx) => original,
	set: (original, ctx) => original,
});

Annotate.intercept.field({
	init: (initial, ctx) => initial,
});
```

The interceptor context exposes the decorated member and a `get(instance)` helper for reading this interceptor's metadata on the current member. The return type of `ctx.get(instance)` follows cardinality just like annotation readers.

## Validation And Target Constraints

The current validation model remains useful, but the option names should be simplified:

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

`requireInstanceOf` is renamed to `requires`:

```ts
const Route = Annotate.method({
	requires: ControllerBase,
	args: (method: "GET" | "POST", path: string) => ({ method, path }),
});
```

`requires` means the class hosting the decorator must extend the supplied constructor.

The existing runtime semantics should remain: class and static member validation occurs during class evaluation, while instance member validation occurs on first construction or first reflective read.

## Compatibility Posture

This is a breaking redesign. Public docs should teach `Annotate` only.

The existing `decorate` and `intercept` public exports are removed in the breaking release. No legacy public subpath is planned for v1.

The implementation may temporarily keep lower-level internal helpers that resemble the current factories, but those names are not exported as public API.

## Internal Refactor Direction

The current implementation has repeated factory code across class, method, property, accessor, and interceptor variants. The redesign should consolidate this into a smaller core:

- A key/cardinality module that understands public `"one" | "many"` and internal storage cardinality.
- A shared annotation handle builder that creates callable decorators with attached read helpers.
- Thin target adapters for class, method, field, accessor, and interceptor behavior.
- A read layer that supports proxy-backed typed selectors and reflected collections without name-based helper methods.

Runtime invariants already covered by tests should be preserved:

- Stage-3 decorator support only.
- No `reflect-metadata`.
- Lazy preparation for instance members.
- Inheritance-aware reads.
- Duplicate protection for one-cardinality annotations.
- Repeated storage for many-cardinality annotations.
- Typed reader results based on metadata and cardinality.

## Non-Goals

- Preserve the existing `decorate.*` / `intercept.*` API as the canonical public API.
- Require string keys or string labels.
- Teach string member-name reads as the normal way to read member metadata.
- Support legacy TypeScript decorators or parameter decorators.
- Use `reflect-metadata`.

## Open Questions

No unresolved public API questions remain in this draft. Further work should move into implementation planning after user review.
