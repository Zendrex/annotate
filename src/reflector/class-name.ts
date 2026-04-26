import type { AnyConstructor } from "./types";

/**
 * Stable display name for a constructor, used in error messages and diagnostics.
 *
 * @param ctor - Class constructor; when `name` is missing or empty (common for anonymous classes), the implementation uses a single fixed fallback string instead
 * @returns The constructor’s `name` when that value is a non-empty string; otherwise the same fallback the implementation uses for anonymous classes
 */
export function targetDisplayName(ctor: AnyConstructor): string {
	return typeof ctor.name === "string" && ctor.name.length > 0 ? ctor.name : "<anonymous>";
}

/**
 * Formatted "slot" string used in error messages: the class display name on its
 * own for class-level slots, or `Class.member` when a member name is supplied.
 *
 * Quoting is intentionally omitted so call sites can wrap the result however
 * their message template requires.
 *
 * @param target - Class constructor whose display name forms the slot
 * @param memberName - Property or method name; omit for class-level slots
 */
export function formatSlot(target: AnyConstructor, memberName?: string | symbol): string {
	const className = targetDisplayName(target);
	return memberName === undefined ? className : `${className}.${String(memberName)}`;
}
