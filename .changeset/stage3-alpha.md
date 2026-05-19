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

- Consolidated namespaces: `decorate.{class,method,property}` and
  `intercept.{method,accessor,field}`, each with a `.list` sibling for
  list-cardinality keys (`decorate.method.list`, etc.).
- `intercept.field({ onInit })`: class-field interceptor that replaces the
  field's initial value from an `addInitializer` body resolved via
  `this.constructor`. Closure-free by design — survives Bun 1.3's
  `var _init` transformer bug where field-decorator value-replacement
  initializer closures are shared across every class in the same module.
  Companion `intercept.field.list` for list-cardinality metadata.
  `InterceptorContext.kind` extended with `"field"`. New exported type
  `FieldInterceptorOptions<TMeta, TArgs, TField>`.
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

| Before | After |
|---|---|
| `decorate.method({ unique: true })` | `decorate.method(...)` (default) |
| `decorate.method(...)` (append-style) | `decorate.method.list(...)` |
| `factory.reader(t).methodsScalar()` | `factory.reader(t).methods()` |
| `factory.reader(t).propertiesScalar()` | `factory.reader(t).properties()` |
| `import type { DecoratedMethodScalar }` | `import type { DecoratedMethodUnique }` |
| `createParameterDecorator(...)` | (removed) |
| `createPropertyInterceptor(...)` on `accessor` member | `createAccessorInterceptor(...)` |
| `class C { @dec foo = 1 }` interception | requires `accessor foo = 1` |
| `generateKey()` | `mintUniqueKey<T>()` / `mintListKey<T>()` |
