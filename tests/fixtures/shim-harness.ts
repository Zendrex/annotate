/**
 * Subprocess harness for `src/shim.ts`. Run as `bun tests/fixtures/shim-harness.ts <mode>`
 * with `mode` ∈ `present` | `absent` | `idempotent`. Writes a single JSON line to
 * stdout describing the post-import state of `Symbol.metadata`.
 *
 * Used by `tests/unit/shim.test.ts` so each scenario starts with a clean
 * module cache and global symbol slot.
 */

type SymbolWithMetadata = SymbolConstructor & { metadata: symbol | undefined };

const mode = process.argv[2] as "present" | "absent" | "idempotent" | undefined;
if (mode !== "present" && mode !== "absent" && mode !== "idempotent") {
	throw new Error(`shim-harness: unknown mode ${String(mode)}`);
}

const symbolCtor = Symbol as SymbolWithMetadata;
const registrySymbol = Symbol.for("Symbol.metadata");

if (mode === "absent") {
	// Strip the well-known slot before the shim runs so we exercise the install
	// path even when the host engine ships Symbol.metadata natively. Redefine
	// rather than `delete` to satisfy lint while erasing the value the shim
	// branches on.
	Object.defineProperty(symbolCtor, "metadata", {
		value: undefined,
		writable: true,
		enumerable: false,
		configurable: true,
	});
}

if (mode === "idempotent") {
	// Pre-install a sentinel and verify the shim does not overwrite it.
	Object.defineProperty(symbolCtor, "metadata", {
		value: registrySymbol,
		writable: false,
		enumerable: false,
		configurable: true,
	});
}

await import("../../src/shim");

const after = symbolCtor.metadata;
const result = {
	defined: typeof after === "symbol",
	isRegistry: after === registrySymbol,
	description: after?.description ?? null,
};

process.stdout.write(`${JSON.stringify(result)}\n`);
