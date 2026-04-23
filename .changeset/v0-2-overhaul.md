---
"@zendrex/annotate": minor
---

v0.2 API and module reorganization.

Restructure the library into focused submodules under `src/factories`, `src/metadata`, and `src/reflector`, replacing the previous monolithic `src/lib/*` layout. The public import path (`@zendrex/annotate`) is unchanged; the internal module graph is not part of the supported surface.

New public API:

- `reflectInstance(instance)` and `ofInstance(instance)` on every decorator factory — instance-based reflection that resolves the owning constructor. Both runtime-guard the constructor shape and throw `TypeError` on bare objects, primitives, and arrow/bound functions.
- `metadataOf(target)` on class decorator factories — singleton accessor returning the first metadata value applied to a class (or `undefined`), walking the prototype chain.
- `requireMetadata(target)` on class decorator factories — throwing sibling of `metadataOf`; throws `AnnotateError` with `reason: "missing"` when neither the target nor any ancestor carries metadata.
- `applied(target)` / `appliedOwn(target)` on class decorator factories — boolean predicates; `applied` walks the prototype chain, `appliedOwn` checks direct application only.
- `createClassDecorator` now accepts an options object `{ unique?: boolean; name?: string; compose?: (...args) => TMeta }`. With `unique: true`, the decorator throws `AnnotateError` when applied twice to the same class (inherited metadata is not treated as a duplicate). The legacy `createClassDecorator(composeFn)` signature is preserved.
- Exported `AnnotateError` class with `decoratorKey`, `kind`, `reason`, and `target` fields for distinct `instanceof` handling.

Tests reorganized into `tests/unit/` (mirroring `src/`), `tests/integration/`, and `tests/fixtures/` for shared helpers.
