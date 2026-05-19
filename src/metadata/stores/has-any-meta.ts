import { hasOwnAnyClassMeta } from "./class-meta-store";
import { hasOwnAnyMemberMeta } from "./member-meta-store";
import { chainHasNonEmpty } from "./store-walk";
import type { Ctor } from "../types";

export function hasAnyMeta(ctor: Ctor): boolean {
	return chainHasNonEmpty(ctor, (current) => hasOwnAnyClassMeta(current) || hasOwnAnyMemberMeta(current));
}
