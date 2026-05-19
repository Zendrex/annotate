---
"@zendrex/annotate": major
---

# v1.0.0-alpha.0 — Stage-3 rework

Hard replace of the v0.x experimental-decorator surface. v0.x callers do not
continue to work.

## Runtime + build

- Migrate every factory to TC39 Stage-3 decorators.
  `experimentalDecorators` / `emitDecoratorMetadata` must be `false`.
- Drop `reflect-metadata` peer dependency. Metadata payloads live in
  annotate-owned `WeakMap`s keyed by class constructor;
  `class[Symbol.metadata]` is read only as an identity-only correlation
  channel. Runtime floor: Node ≥ 20.4 for native `Symbol.metadata`, or a
  transpiler/`@zendrex/annotate/shim` shim. TypeScript ≥ 5.2.
- Instance-member metadata registers lazily on first instantiation unless
  the class has a class decorator, a static decorated member,
  `prepare(ctor)` is called explicitly, or the reflector auto-prepares.
- `prepare(ctor)` exported as the explicit eager-flush escape hatch.

## Public API

- `Annotate` is the canonical decorator namespace:
  `Annotate.class`, `Annotate.method`, `Annotate.field`,
  `Annotate.accessor`, and `Annotate.intercept.{method,accessor,field}`.
- Annotation handles are callable decorators with an attached `.read(target)`
  API. Class reads use `.get()`, member reads use typed selectors such as
  `.get((api) => api.index)`, and collection reads use `.entries()`,
  `.methods()`, `.fields()`, or `.accessors()`.
- Cardinality is configured with `cardinality: "one" | "many"` instead of
  separate list builders. `"one"` is the default; `"many"` returns frozen
  metadata arrays from reads.
- `Annotate.intercept.field({ init })`: class-field interceptor that replaces
  the field's initial value and includes an internal recovery path for Bun
  1.3's `var _init` transformer bug where field-decorator value-replacement
  initializer closures can be skipped across fields in the same module.
- Public interceptor contexts expose `kind`, `name`, `static`, and
  `ctx.get(instance)` for reading the interceptor's own metadata.
- `mintUniqueKey<T>(description?)` and `mintListKey<T>(description?)`
  replace the old `generateKey`. `MetadataKey<TValue, TCard>` is generic
  and branded; aliases `UniqueMetadataKey<T>` and `ListMetadataKey<T>`.
- Free `reflect(target)`, `Reflector`, `ScopedReflector`, and `prepare(ctor)`
  remain available for low-level tooling that deliberately manages keys.
- `DecoratedMethod<T>` / `DecoratedProperty<T>` / `DecoratedClass<T>` split
  into `*Unique<T>` / `*List<T>`; the unparameterized aliases are unions.
  Reflector overloads narrow on key brand.

## Decorator options

- Direct metadata form: `Annotate.method<T>()`.
- Argument mapper form: `Annotate.method((arg) => metadata)`.
- Options form: `{ label, args, cardinality, validate, requires }`.
- `validate(meta, context)` runs after argument mapping and before commit.
  Throwing aborts the decoration. For instance members, validation is
  deferred until `prepare(ctor)` so `context.target` is the concrete class
  constructor.
- `requires: Base` rejects decorations hosted by classes that do not extend
  `Base`.

## Errors

- `UnregisteredClassError` (code `"unregistered"`) — `reflect()` of a class
  with no registered metadata. `applied(...)` / `appliedOwn(...)` never
  throw and return `false` on the unregistered path.
- `DuplicateMetadataError` (code `"duplicate"`) — carries key, kind, and
  target context for duplicate one-cardinality annotations.
- `InvalidDecorationTargetError` (code `"invalidTarget"`) — thrown when
  `requires` rejects the decorated host class.
- `ValidationError` (code `"validation"`) — thrown when `validate` rejects;
  original throwable preserved on `Error.cause`.
- `MissingMetadataError` (code `"missing"`) — thrown by `firstOrThrow`.

## Removed

- `createParameterDecorator` and the parameter reflector slice. Stage-3
  has no parameter decorator primitive.
- The old `decorate.*` / `intercept.*` public API and the source-level
  compatibility registry.
- Public factory helper type exports such as `DecoratorOptions`,
  `Decorated*Factory`, `MetadataOf`, `ArgsOf`, `ThisOf`, and
  `CardinalityOf`.
- Property-interceptor behavior based on descriptors. Auto-accessor wrapping
  uses `Annotate.intercept.accessor`; plain field value replacement uses
  `Annotate.intercept.field`.
- `InterceptorContext.descriptor` and `.owner` (Stage-3 context carries
  `name` / `static` / `kind` directly).
- `unique` field on every `DecoratorOptions` variant (cardinality lives on
  the key brand).
- `methodsScalar` / `propertiesScalar` on `ScopedReflector` and the
  `DecoratedMethodScalar` / `DecoratedPropertyScalar` exports.
- The `ensureProperty` workaround. Non-annotate introspection of decorated
  classes will observe different results (`"x" in Ctor.prototype`,
  `Object.keys(instance)`, etc.). Use annotation-handle readers or
  `reflect(ctor)` to enumerate decorated members.

## Migration

| Before | After |
|---|---|
| `decorate.method(...)` | `Annotate.method(...)` |
| `decorate.property(...)` | `Annotate.field(...)` |
| `intercept.method({ intercept })` | `Annotate.intercept.method({ wrap })` |
| `intercept.accessor({ onGet, onSet })` | `Annotate.intercept.accessor({ get, set })` |
| `intercept.field({ onInit })` | `Annotate.intercept.field({ init })` |
| `.list` factory variants | `{ cardinality: "many" }` |
| `name` option | `label` option |
| `compose` option | `args` option |
| `requireInstanceOf` option | `requires` option |
| `factory.first(target, "name")` | `Factory.read(target).get((x) => x.name)` |
| `factory.reader(t).methods()` | `Factory.read(t).methods()` |
| `createParameterDecorator(...)` | (removed) |
| `generateKey()` | `mintUniqueKey<T>()` / `mintListKey<T>()` |
