/**
 * Side-effect shim for runtimes that lack native `Symbol.metadata`.
 *
 * TC39 Stage-3 decorators store metadata on the well-known `Symbol.metadata`
 * slot. Engines that have not yet shipped it (Node < 22.3, older browsers,
 * some embedded runtimes) leave `Symbol.metadata` undefined, so the decorator
 * transformer cannot place a correlation object where the runtime can find it.
 *
 * Importing this module once at the application entry installs the registry
 * symbol `Symbol.for("Symbol.metadata")` onto the global `Symbol` so the
 * transformer and the runtime agree on the slot. This is the same value
 * `METADATA_SYMBOL` falls back to in `runtime/symbol-metadata.ts`, keeping
 * both sides in sync.
 *
 * Safe to import on engines that already define `Symbol.metadata`: the
 * existing native value is left untouched.
 */

type SymbolWithMetadata = SymbolConstructor & { metadata: symbol };

const symbolCtor = Symbol as SymbolWithMetadata;

if (symbolCtor.metadata === undefined) {
	Object.defineProperty(symbolCtor, "metadata", {
		value: Symbol.for("Symbol.metadata"),
		writable: false,
		enumerable: false,
		configurable: true,
	});
}
