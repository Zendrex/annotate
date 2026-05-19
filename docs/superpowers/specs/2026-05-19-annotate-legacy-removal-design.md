# Annotate Legacy Removal Design

## Goal

Remove the remaining legacy API layer from `@zendrex/annotate` so the public
surface and internal implementation vocabulary center on `Annotate.*`.

This is a breaking cleanup on top of the Stage-3 redesign. The old
`decorate.*`, top-level `intercept.*`, `.list` builder variants, and factory
helper type surface are not compatibility targets.

## Scope

The cleanup removes or renames code that presents the pre-`Annotate` API as a
supported model:

- Delete `src/legacy.ts`.
- Remove any public exports of `decorate` and top-level `intercept`.
- Remove public exports of factory helper types such as `DecoratorOptions`,
  `Decorated*Factory`, `MetadataOf`, `ArgsOf`, `ThisOf`, and `CardinalityOf`.
- Rename internal option vocabulary from `compose`, `name`, and
  `requireInstanceOf` to `args`, `label`, and `requires`.
- Rename interceptor hook vocabulary from `intercept`, `onGet`, `onSet`, and
  `onInit` to `wrap`, `get`, `set`, and `init`.
- Replace tests and type tests that teach or rely on legacy factory APIs with
  `Annotate.*` tests.

Low-level runtime modules remain only when they are implementation details, and
their exported names must not describe the old public API.

## Public API

The canonical decorator API is:

```ts
Annotate.class(...)
Annotate.method(...)
Annotate.field(...)
Annotate.accessor(...)
Annotate.intercept.method(...)
Annotate.intercept.accessor(...)
Annotate.intercept.field(...)
```

The package will still export deliberate low-level primitives:

- `reflect`
- `prepare`
- `mintUniqueKey`
- `mintListKey`
- metadata key and reflector types
- domain error classes

Those exports are not legacy compatibility APIs.

## Internal API

Internal builders will use Stage-3 and Annotate terminology directly:

```ts
type AnnotationOptions<TMeta, TArgs> = {
  label?: string;
  args?: (...args: TArgs) => TMeta;
  requires?: AnyConstructor;
  validate?: ValidatorFn<TMeta>;
};
```

Cardinality is expressed at the public edge as `"one" | "many"` and
converted only where the storage layer needs its existing key brands.

If lower-level builder functions remain, their names must describe the target
they build for rather than the removed public factory API. For example,
implementation helpers can remain target-specific, but tests must not present
`createMethodDecorator` or `.list` as supported user-facing entrypoints.

## Tests

Tests will prove the new API and the retained low-level primitives:

- `Annotate.*` direct metadata, argument mapper, options, `requires`,
  validation, and cardinality behavior.
- `Annotate.intercept.*` hook names and `ctx.get(instance)` cardinality types.
- Low-level `reflect`, `prepare`, and metadata key behavior where still public.
- No imports from `src/legacy.ts`.
- No public API type assertions for removed factory helper types.

Existing runtime regression coverage must be preserved when it verifies
current behavior rather than legacy naming.

## Non-Goals

- Preserve source compatibility with v0.x callers.
- Provide a legacy subpath.
- Support legacy TypeScript decorators, parameter decorators, or
  `reflect-metadata`.
- Rewrite the storage and reflection runtime beyond what is needed to remove
  legacy API language safely.

## Success Criteria

- Searching source and tests for removed public API names finds only migration
  documentation or release notes.
- Type checking succeeds with `Annotate.*` as the only decorator factory API.
- Unit and integration tests pass.
- Build output contains no `src/legacy` equivalent and no `decorate` or
  top-level `intercept` export.
