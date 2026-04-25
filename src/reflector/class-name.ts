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
