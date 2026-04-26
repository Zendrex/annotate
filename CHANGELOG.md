# @zendrex/annotate

## 1.0.0-alpha.0

### Major Changes

- [`21b1d11`](https://github.com/Zendrex/annotate/commit/21b1d118487c19f1a3459372a4db5dd18d03eb6f) Thanks [@Zendrex](https://github.com/Zendrex)! - # v1.0.0-alpha.0 — Stage-3 rework

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

  - Consolidated namespaces: `decorate.{class,method,property}` and
    `intercept.{method,accessor}`, each with a `.list` sibling for
    list-cardinality keys (`decorate.method.list`, etc.).
  - `mintUniqueKey<T>(description?)` and `mintListKey<T>(description?)`
    replace the old `generateKey`. `MetadataKey<TValue, TCard>` is generic
    and branded; aliases `UniqueMetadataKey<T>` and `ListMetadataKey<T>`.
  - Per-factory accessors: `has` / `hasOwn` / `first` / `firstOrThrow` /
    `all` / `reader`. Free `reflect(target)` and `Reflector` /
    `ScopedReflector` unchanged.
  - `DecoratedMethod<T>` / `DecoratedProperty<T>` / `DecoratedClass<T>` split
    into `*Unique<T>` / `*List<T>`; the unparameterized aliases are unions.
    Reflector overloads narrow on key brand.
  - `Factory.derive<TThis, ...>(options?)` shares the parent's metadata key.
    Accepts `Pick<DecoratorOptions, "name" | "validate" |
"requireInstanceOf">`. Parent's validator runs before child's;
    `requireInstanceOf` replaces.
  - Type helpers `MetadataOf<F>` / `ArgsOf<F>` / `ThisOf<F>` /
    `CardinalityOf<F>` for consumer generics.

  ## Decorator options

  - Decorator-side type constraints via `TInstance` / `TField` / `TMethod`
    generics. `createPropertyDecorator<M, [M], number>()` rejects
    application to a `boolean` field at compile time.
  - `validate(meta, context)` option runs after compose, before commit;
    throwing aborts the decoration. For instance members, deferred until
    `prepare(ctor)` so `context.target` is the concrete class constructor.
  - `requireInstanceOf: Base` declarative sugar over `validate`; rejects
    when the target class is not a subclass of `Base`.

  ## Errors

  - `UnregisteredClassError` (code `"unregistered"`) — `reflect()` of a class
    with no registered metadata. `applied(...)` / `appliedOwn(...)` never
    throw and return `false` on the unregistered path.
  - `DuplicateMetadataError` (code `"duplicate"`) — carries cardinality +
    label.
  - `InvalidDecorationTargetError` (code `"invalidTarget"`) — thrown when
    `requireInstanceOf` rejects.
  - `ValidationError` (code `"validation"`) — thrown when `validate` rejects;
    original throwable preserved on `Error.cause`.
  - `MissingMetadataError` (code `"missing"`) — thrown by `firstOrThrow`.

  ## Removed

  - `createParameterDecorator` and the parameter reflector slice. Stage-3
    has no parameter decorator primitive.
  - `createPropertyInterceptor` — renamed to `createAccessorInterceptor`,
    requires the `accessor` keyword (or `get`/`set` members). Plain fields
    still work for metadata via `createPropertyDecorator`, but no
    interception.
  - `InterceptorContext.descriptor` and `.owner` (Stage-3 context carries
    `name` / `static` / `kind` directly).
  - `unique` field on every `DecoratorOptions` variant (cardinality lives on
    the key brand).
  - `methodsScalar` / `propertiesScalar` on `ScopedReflector` and the
    `DecoratedMethodScalar` / `DecoratedPropertyScalar` exports.
  - The `ensureProperty` workaround. Non-annotate introspection of decorated
    classes will observe different results (`"x" in Ctor.prototype`,
    `Object.keys(instance)`, etc.). Use `Factory.applied(ctor, name)` /
    `Factory.reflect(ctor).properties()` to enumerate decorated members.

  ## Migration

  | Before                                                | After                                     |
  | ----------------------------------------------------- | ----------------------------------------- |
  | `decorate.method({ unique: true })`                   | `decorate.method(...)` (default)          |
  | `decorate.method(...)` (append-style)                 | `decorate.method.list(...)`               |
  | `factory.reader(t).methodsScalar()`                   | `factory.reader(t).methods()`             |
  | `factory.reader(t).propertiesScalar()`                | `factory.reader(t).properties()`          |
  | `import type { DecoratedMethodScalar }`               | `import type { DecoratedMethodUnique }`   |
  | `createParameterDecorator(...)`                       | (removed)                                 |
  | `createPropertyInterceptor(...)` on `accessor` member | `createAccessorInterceptor(...)`          |
  | `class C { @dec foo = 1 }` interception               | requires `accessor foo = 1`               |
  | `generateKey()`                                       | `mintUniqueKey<T>()` / `mintListKey<T>()` |

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
