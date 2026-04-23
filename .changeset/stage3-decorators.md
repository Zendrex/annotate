---
"@zendrex/annotate": major
---

# v1.0.0-alpha.0 — TC39 Stage-3 decorators

Migrates every factory from TypeScript experimental decorators to TC39
Stage-3 decorators. Hard replace; v0.x callers do not continue to work.

## Breaking changes

1. `experimentalDecorators` / `emitDecoratorMetadata` no longer required and
   must be `false` for Stage-3 semantics.
2. `reflect-metadata` peer dependency dropped. Metadata payloads move to
   annotate-owned `WeakMap`s keyed by class constructor. Annotate reads
   `class[Symbol.metadata]` only as an identity-only correlation channel.
   Runtime floor: Node ≥ 20.4 for native `Symbol.metadata`, or a
   transpiler-provided shim. Supported TypeScript versions: 5.2+.
3. `createParameterDecorator` and the parameter reflector slice removed.
   Stage-3 has no parameter decorator primitive.
4. `createPropertyInterceptor` renamed to `createAccessorInterceptor` and
   requires the `accessor` keyword (or `get` / `set` members). Plain fields
   still work for metadata attachment via `createPropertyDecorator`, but no
   interception.
5. `InterceptorContext` drops `descriptor` and `owner`. Stage-3 context carries
   the necessary information (`name`, `static`, `kind`) directly.
6. Reflection of a class with no registered metadata throws
   `UnregisteredClassError` instead of returning an empty view. `applied(...)`
   / `appliedOwn(...)` never throw and return `false` on the unregistered path.
7. Instance-member metadata registers lazily on first instantiation unless the
   class has a class decorator, a static decorated member, `materialize(ctor)`
   is called explicitly, or the reflector auto-materializes.
8. The `ensureProperty` workaround is removed. Consumers doing non-annotate
   introspection of decorated classes will observe different results
   (`"x" in Ctor.prototype`, `Object.keys(instance)`, etc.). Use
   `Factory.applied(ctor, name)` / `Factory.reflect(ctor).properties()` to
   enumerate decorated members.

## New

- Decorator-side type constraints via `TInstance` / `TField` / `TMethod` /
  `TValue` generics. `createPropertyDecorator<M, [M], number>()` rejects
  application to a `boolean` field at compile time.
- `materialize(ctor)` exported as an explicit eager-flush escape hatch.
- `UnregisteredClassError` exported.
- `DuplicateMetadataError` exported (subclass of `AnnotateError` with `code:
  "duplicate"`).
