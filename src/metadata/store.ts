import type { ClassBucket, Deferred, MemberBucket } from "./types";

// biome-ignore lint/complexity/noBannedTypes: WeakMap key requires Function for constructor identity.
// biome-ignore lint/correctness/noUnusedVariables: Scaffold storage — populated in Phase C2-C5.
const classMetaStore = new WeakMap<Function, ClassBucket>();

// biome-ignore lint/complexity/noBannedTypes: WeakMap key requires Function for constructor identity.
// biome-ignore lint/correctness/noUnusedVariables: Scaffold storage — populated in Phase C2-C5.
const memberMetaStore = new WeakMap<Function, MemberBucket>();

// Spec writes WeakSet; ES forbids symbol WeakSet keys, so we use Set. Tokens are short-lived per decoration batch.
// biome-ignore lint/complexity/noBannedTypes: WeakMap key requires Function for constructor identity.
// biome-ignore lint/correctness/noUnusedVariables: Scaffold storage — populated in Phase C2-C5.
const committedTokens = new WeakMap<Function, Set<symbol>>();

// biome-ignore lint/correctness/noUnusedVariables: Scaffold storage — populated in Phase C2-C5.
const pendingByMetadata: WeakMap<object, Deferred[]> = new WeakMap();

// biome-ignore lint/complexity/noBannedTypes: WeakMap value stores constructor references for reverse lookup.
// biome-ignore lint/correctness/noUnusedVariables: Scaffold storage — populated in Phase C2-C5.
const metadataToCtor: WeakMap<object, Function> = new WeakMap();

// biome-ignore lint/complexity/noBannedTypes: WeakMap key requires Function for constructor identity.
// biome-ignore lint/correctness/noUnusedVariables: Scaffold storage — populated in Phase C2-C5.
const ctorToMetadata = new WeakMap<Function, object>();

export function _internalReset(): void {
	// Test-only reset hook is not provided — WeakMaps cannot be enumerated.
	// Tests must use fresh classes per scenario; class identity is the GC root.
}
