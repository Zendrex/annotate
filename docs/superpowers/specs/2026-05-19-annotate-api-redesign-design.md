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
	list() {}
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
	list() {}
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

The `.list` namespace is removed from the public API. It is terse but unclear, and it forces users to learn a library-specific concept before understanding the behavior.

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
Role.read(Api).first((api) => api.list); // string | undefined
Tag.read(Api).all((api) => api.list); // readonly string[]
```

## Reading Metadata

The canonical read API must avoid stringly member names. Passing `"list"` to read a method is an escape hatch, not the recommended path.

Preferred reads use typed selectors or reflected collections:

```ts
Role.read(Api).has((api) => api.list);
Role.read(Api).first((api) => api.list);
Role.read(Api).all((api) => api.list);
```

Field reads use the same selector shape:

```ts
Column.read(User).has((user) => user.name);
Column.read(User).first((user) => user.name);
```

Framework builders can enumerate collections:

```ts
for (const method of Route.read(Api).methods()) {
	method.name;
	method.metadata;
}
```

String-based member reads can exist, but they must be clearly named as escape hatches:

```ts
Role.read(Api).byName("list");
Role.read(Api).hasName("list");
```

These methods are not used in primary documentation examples.

## Interceptors

Interceptors live under `Annotate.intercept` so they remain part of the same mental model.

Method interceptor example:

```ts
const Log = Annotate.intercept.method<string>({
	label: "Log",
	wrap: (original, ctx) =>
		function (...args) {
			ctx.read(this);
			return original.apply(this, args);
		},
});
```

Open design area: finalize exact interceptor hook names and context shape. The current direction is to use plain names like `wrap`, `get`, `set`, and `init` instead of the existing `intercept`, `onGet`, `onSet`, and `onInit` names.

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

Open design area: decide whether `requireInstanceOf` should be renamed. Candidate names:

- `require`
- `requires`
- `target`
- `host`

The existing runtime semantics should remain: class and static member validation occurs during class evaluation, while instance member validation occurs on first construction or first reflective read.

## Compatibility Posture

This is a breaking redesign. Public docs should teach `Annotate` only.

The implementation may temporarily keep lower-level internal helpers that resemble the current `decorate` / `intercept` factories, but those names are not part of the desired v1 public API.

## Internal Refactor Direction

The current implementation has repeated factory code across class, method, property, accessor, and interceptor variants. The redesign should consolidate this into a smaller core:

- A key/cardinality module that understands public `"one" | "many"` and internal storage cardinality.
- A shared annotation handle builder that creates callable decorators with attached read helpers.
- Thin target adapters for class, method, field, accessor, and interceptor behavior.
- A read layer that supports typed selectors, reflected collections, and explicitly named string escape hatches.

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

1. Finalize selector implementation details and limitations. TypeScript selectors are type-safe at compile time, but runtime member-name extraction requires a deliberate strategy.
2. Finalize static member selector syntax.
3. Finalize interceptor hook names and context type.
4. Choose a replacement name for `requireInstanceOf`, if any.
5. Decide whether the old public API is removed immediately or kept under a legacy subpath during transition.
