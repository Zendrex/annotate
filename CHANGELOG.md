# @zendrex/annotate

## 1.0.0

### Major Changes

- [#23](https://github.com/Zendrex/annotate/pull/23) [`31fe5eb`](https://github.com/Zendrex/annotate/commit/31fe5ebd0b1aed3a0a5fa9d509931a84163b5349) Thanks [@Zendrex](https://github.com/Zendrex)! - # Stage-3 decorators rework

  Hard replace of the v0.x experimental-decorator surface. v0.x callers do not
  continue to work.

  ## Runtime + build

  - Migrate every factory to TC39 Stage-3 decorators.
    `experimentalDecorators` / `emitDecoratorMetadata` must be `false`.
  - Drop `reflect-metadata` peer dependency. Metadata payloads live in
    annotate-owned `WeakMap`s keyed by class constructor;
    `class[Symbol.metadata]` is read only as an identity-only correlation
    channel. TypeScript ≥ 5.2 must emit Stage-3 decorators. Import
    `@zendrex/annotate/shim` once before decorated classes load on runtimes
    that do not expose native `Symbol.metadata`.
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
  - Free `reflect(target)`, `createScopedReflector(ctor, key)`, and
    `prepare(ctor)` remain available for low-level tooling that deliberately
    manages keys.
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

  | Before                                 | After                                       |
  | -------------------------------------- | ------------------------------------------- |
  | `decorate.method(...)`                 | `Annotate.method(...)`                      |
  | `decorate.property(...)`               | `Annotate.field(...)`                       |
  | `intercept.method({ intercept })`      | `Annotate.intercept.method({ wrap })`       |
  | `intercept.accessor({ onGet, onSet })` | `Annotate.intercept.accessor({ get, set })` |
  | `intercept.field({ onInit })`          | `Annotate.intercept.field({ init })`        |
  | `.list` factory variants               | `{ cardinality: "many" }`                   |
  | `name` option                          | `label` option                              |
  | `compose` option                       | `args` option                               |
  | `requireInstanceOf` option             | `requires` option                           |
  | `factory.first(target, "name")`        | `Factory.read(target).get((x) => x.name)`   |
  | `factory.reader(t).methods()`          | `Factory.read(t).methods()`                 |
  | `createParameterDecorator(...)`        | (removed)                                   |
  | `generateKey()`                        | `mintUniqueKey<T>()` / `mintListKey<T>()`   |

## 0.2.0

### Minor Changes

- [#16](https://github.com/Zendrex/annotate/pull/16) [`e90824c`](https://github.com/Zendrex/annotate/commit/e90824cffaa3eb0308dc5c8329e3394b58314874) Thanks [@Zendrex](https://github.com/Zendrex)! - v0.2 API and module reorganization.

  Restructure the library into focused submodules under `src/factories`, `src/metadata`, and `src/reflector`, replacing the previous monolithic `src/lib/*` layout. The public import path (`@zendrex/annotate`) is unchanged; the internal module graph is not part of the supported surface.

  New public API:

  - `reflectInstance(instance)` and `ofInstance(instance)` on every decorator factory — instance-based reflection that resolves the owning constructor. Both runtime-guard the constructor shape and throw `TypeError` on bare objects, primitives, and arrow/bound functions.
  - `metadataOf(target)` on class decorator factories — singleton accessor returning the first metadata value applied to a class (or `undefined`), walking the prototype chain.
  - `requireMetadata(target)` on class decorator factories — throwing sibling of `metadataOf`; throws `AnnotateError` with `reason: "missing"` when neither the target nor any ancestor carries metadata.
  - `applied(target)` / `appliedOwn(target)` on class decorator factories — boolean predicates; `applied` walks the prototype chain, `appliedOwn` checks direct application only.
  - **Breaking:** `createClassDecorator` now takes only an options object `{ unique?: boolean; name?: string; compose?: (...args) => TMeta }`. The legacy `createClassDecorator(composeFn)` positional signature is removed — pass the compose function as `options.compose`. With `unique: true`, the decorator throws `AnnotateError` when applied twice to the same class (inherited metadata is not treated as a duplicate).
  - Exported `AnnotateError` class with `decoratorKey`, `kind`, `reason`, and `target` fields for distinct `instanceof` handling.

  Tests reorganized into `tests/unit/` (mirroring `src/`), `tests/integration/`, and `tests/fixtures/` for shared helpers.

## 0.1.5

### Patch Changes

- [`a9cc051`](https://github.com/Zendrex/annotate/commit/a9cc0510d7222d280eafaee42f0f6d646fba2ba0) Thanks [@Zendrex](https://github.com/Zendrex)! - Add property injection example to docs and JSDoc

- [`6f318ce`](https://github.com/Zendrex/annotate/commit/6f318cee4cb1383642f66b643f038bdd1ad33d50) Thanks [@Zendrex](https://github.com/Zendrex)! - Migrate build tooling from tsup to tsdown and update dependencies

## 0.1.4

### Patch Changes

- [`293356c`](https://github.com/Zendrex/annotate/commit/293356cbffa98a32ed026b7d4b865b0a204129cb) Thanks [@Zendrex](https://github.com/Zendrex)! - Cleaned up JSDoc documentation across the library: fixed incorrect `@see` references, removed redundant `@see` tags and repetitive boilerplate, added missing type assertion justifications, and trimmed over-explained type aliases for documentation-page readiness.

## 0.1.3

### Patch Changes

- [`a2d7b93`](https://github.com/Zendrex/annotate/commit/a2d7b93f20c8986be6c5b1575e6d8045ebd83e66) Thanks [@Zendrex](https://github.com/Zendrex)! - Refactor reflector parameter collection into a shared helper and apply consistent formatting across source files.

## 0.1.2

### Patch Changes

- [`eb061bf`](https://github.com/Zendrex/annotate/commit/eb061bf33d0765575f5443e72c91d335582e2e62) Thanks [@Zendrex](https://github.com/Zendrex)! - added changesets to project

- [`ff721d0`](https://github.com/Zendrex/annotate/commit/ff721d0664b82e182b335f405935b4961e170511) Thanks [@Zendrex](https://github.com/Zendrex)! - removed useless script from packagejson
