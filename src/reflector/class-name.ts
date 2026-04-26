import type { AnyConstructor } from "./types";

/**
 * Stable display name for a constructor; falls back to `"<anonymous>"` when
 * `name` is missing or empty.
 */
export function targetDisplayName(ctor: AnyConstructor): string {
	return typeof ctor.name === "string" && ctor.name.length > 0 ? ctor.name : "<anonymous>";
}

/**
 * Formatted slot string for error messages: the class display name alone for
 * class-level slots, or `Class.member` when a member name is supplied. Quoting
 * is left to the caller so message templates can wrap the result freely.
 */
export function formatSlot(target: AnyConstructor, memberName?: string | symbol): string {
	const className = targetDisplayName(target);
	return memberName === undefined ? className : `${className}.${String(memberName)}`;
}
