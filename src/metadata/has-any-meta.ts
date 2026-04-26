import { hasOwnAnyClassMeta } from "./class-meta-store";
import { hasOwnAnyMemberMeta } from "./member-meta-store";
import { chainHasNonEmpty } from "./store-walk";
import type { Ctor } from "./types";

/**
 * True if any class in the prototype chain of `ctor` has at least one
 * class-level or member-level metadata entry.
 *
 * Hot path: this is a single chain walk that probes both stores per link and
 * short-circuits on the first link with any data. Replaces the older pattern
 * `hasAnyClassMeta(ctor) || hasAnyMemberMeta(ctor)`, which walked the chain
 * twice — once per store.
 */
export function hasAnyMeta(ctor: Ctor): boolean {
	return chainHasNonEmpty(ctor, (current) => hasOwnAnyClassMeta(current) || hasOwnAnyMemberMeta(current));
}
