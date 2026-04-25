---
"@zendrex/annotate": major
---

# v1.0.0-alpha.2 — Cardinality-typed metadata keys

Lifts decorator cardinality (`unique` vs `list`) into the metadata key type so
the compiler, the store, and the reflector share one source of truth. Scalar
reader methods are removed; the return shape of every reflector call narrows
automatically from the key brand.

## Removed

- `unique` field on every `DecoratorOptions` variant (and the error path tied to
  `options.unique` mismatch).
- `Deferred.unique`; the `unique` parameter on `appendClassMeta` /
  `appendMemberMeta`.
- `methodsScalar` / `propertiesScalar` on `ScopedReflector`.
- `DecoratedMethodScalar` / `DecoratedPropertyScalar` exports.

## Changed

- `MetadataKey` is now generic and branded (`MetadataKey<TValue, TCard>`).
  Aliases `UniqueMetadataKey<T>` and `ListMetadataKey<T>`. Consumer code that
  typed keys as bare `symbol` must adopt the branded aliases to call the new
  reflector overloads.
- `DecoratedMethod<T>` / `DecoratedProperty<T>` / `DecoratedClass<T>` split into
  `*Unique<T>` and `*List<T>`. The unparameterized aliases become unions of the
  two flavors.
- Default factory behavior flips: `decorate.method(...)` is now unique.
  Append-default callers must move to `decorate.method.list(...)` (and same for
  `decorate.class.list`, `decorate.property.list`, `intercept.method.list`,
  `intercept.accessor.list`).
- Per-factory `.all(...)` on a unique factory now caps at length ≤ 1 (signature
  unchanged; semantic tightening). Multi-append callers must move to the `.list`
  sibling.

## New

- `mintUniqueKey<T>(description?)` and `mintListKey<T>(description?)` — replace
  the old `generateKey`.
- `UnregisteredMetadataKeyError` (code `"unregisteredKey"`) — thrown when a
  store append targets a key absent from the cardinality registry (key minted
  outside `mintUniqueKey` / `mintListKey`).
- `decorate.class.list`, `decorate.method.list`, `decorate.property.list`,
  `intercept.method.list`, `intercept.accessor.list` — list-cardinality factory
  siblings on each namespace.
- Branded result types: `DecoratedMethodUnique<T>` / `DecoratedMethodList<T>` /
  `DecoratedClassUnique<T>` / `DecoratedClassList<T>` /
  `DecoratedPropertyUnique<T>` / `DecoratedPropertyList<T>`.

## Migration

| Before | After |
|---|---|
| `decorate.method({ unique: true })` | `decorate.method(...)` (now default) |
| `decorate.method(...)` (append) | `decorate.method.list(...)` |
| `factory.reader(t).methodsScalar()` | `factory.reader(t).methods()` (returns `DecoratedMethodUnique<T>[]`) |
| `factory.reader(t).propertiesScalar()` | `factory.reader(t).properties()` |
| `import type { DecoratedMethodScalar }` | `import type { DecoratedMethodUnique }` |
