---
"@zendrex/annotate": major
---

# v1.0.0-alpha.1 — API rework

Public surface consolidates onto `decorate.*` / `intercept.*` namespaces with
`Object.hasOwn`-precedent predicates, cardinality-explicit accessors, and a
small set of new factory features.

## Factory namespaces

- `decorate.class<TMeta>()`, `decorate.method`, `decorate.property`
- `intercept.method`, `intercept.accessor`

## Factory accessor surface

- `factory.has(target[, member])` / `factory.hasOwn(target[, member])`
- `factory.first(target[, member])` / `factory.firstOrThrow(target[, member])`
- `factory.all(target[, member])` — full `MetadataArray<TMeta>` (frozen)
- `factory.reader(target)` — typed reader entry point
- Free `reflect(target)` and `Reflector` / `ScopedReflector` unchanged

## Reflector cardinality

- `ScopedReflector.methodsScalar()` / `propertiesScalar()`
- Result types `DecoratedMethodScalar<T>` / `DecoratedPropertyScalar<T>`

## Runtime

- `prepare(ctor)` triggers eager metadata registration for instance members.

## Factory features

- **`TThis` generic** (slot 4) on member factories. Narrows the `this`-shape
  a decorator can be applied to. Default `any`.
- **`validate(meta, context)`** option on `DecoratorOptions`. Runs after
  compose, before commit; throwing aborts the decoration. For instance
  members, deferred until `prepare(ctor)` so `context.target` is the concrete
  class constructor.
- **`requireInstanceOf: Base`** option. Declarative sugar over `validate`;
  rejects when the target class is not a subclass of `Base`. Raises
  `InvalidDecorationTargetError` with `requiredBase` populated.
- **`Factory.derive<TThis, ...>(options?)`** on every factory. Shares the
  parent's metadata key. Accepts `Pick<DecoratorOptions, "name" | "validate"
  | "requireInstanceOf">`. Parent's validator runs before child's;
  `requireInstanceOf` replaces.
- **Type helpers `MetadataOf<F>` / `ArgsOf<F>` / `ThisOf<F>`** for consumer
  generics.

## Errors

- **`InvalidDecorationTargetError`** (code `"invalidTarget"`) — thrown when
  `requireInstanceOf` rejects.
- **`ValidationError`** (code `"validation"`) — thrown when a `validate`
  hook rejects. Original throwable preserved on native `Error.cause`.
