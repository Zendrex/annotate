import type { AnyConstructor } from "./types";

/**
 * Stable display name for a constructor. Returns the literal `"<anonymous>"`
 * when `ctor.name` is missing or empty, so error messages and reflection
 * results remain diagnostic for anonymous classes.
 */
export function targetDisplayName(ctor: AnyConstructor): string {
	return typeof ctor.name === "string" && ctor.name.length > 0 ? ctor.name : "<anonymous>";
}
