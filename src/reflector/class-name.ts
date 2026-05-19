import type { AnyConstructor } from "./types";

export function targetDisplayName(ctor: AnyConstructor): string {
	return typeof ctor.name === "string" && ctor.name.length > 0 ? ctor.name : "<anonymous>";
}

export function formatSlot(target: AnyConstructor, memberName?: string | symbol): string {
	const className = targetDisplayName(target);
	return memberName === undefined ? className : `${className}.${String(memberName)}`;
}
