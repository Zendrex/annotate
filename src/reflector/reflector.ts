import { UnregisteredClassError } from "../errors";
import { collectClassMeta, hasAnyClassMeta } from "../metadata/class-meta-store";
import {
	collectMemberMeta,
	collectMemberNames,
	getMemberStatic,
	hasAnyMemberMeta,
} from "../metadata/member-meta-store";
import { prepare } from "../runtime/prepare";
import { targetDisplayName } from "./class-name";
import { resolveReflectTarget } from "./resolve-instance";
import type { Ctor, MetadataKey } from "../metadata/types";
import type { AnyConstructor, DecoratedClass, DecoratedItem, DecoratedMethod, DecoratedProperty } from "./types";

/**
 * Read view over all decoration for a class constructor. Queries are lazy:
 * the first call runs {@link prepare} and fails with {@link UnregisteredClassError}
 * if no metadata is registered for the class.
 */
export interface Reflector {
	all<T>(key: MetadataKey): DecoratedItem<T>[];
	class<T>(key: MetadataKey): DecoratedClass<T> | undefined;
	methods<T>(key: MetadataKey): DecoratedMethod<T>[];
	properties<T>(key: MetadataKey): DecoratedProperty<T>[];
}

function isMethodLike(ctor: Ctor, name: string | symbol, isStatic: boolean): boolean {
	const target = isStatic ? (ctor as object) : (ctor.prototype as object);
	const desc = Object.getOwnPropertyDescriptor(target, name);
	if (!desc) {
		return false;
	}
	return typeof desc.value === "function";
}

export class ReflectorImpl implements Reflector {
	private readonly ctor: AnyConstructor;
	private registered = false;
	private readonly methodLikeCache = new Map<string | symbol, boolean>();

	constructor(target: AnyConstructor) {
		this.ctor = target;
	}

	all<T>(key: MetadataKey): DecoratedItem<T>[] {
		this.ensureRegistered();
		const c = this.collectClass<T>(key);
		const methods = this.collectMembers<T, DecoratedMethod<T>>(key, "method", true);
		const properties = this.collectMembers<T, DecoratedProperty<T>>(key, "property", false);
		return c ? [c, ...methods, ...properties] : [...methods, ...properties];
	}

	class<T>(key: MetadataKey): DecoratedClass<T> | undefined {
		this.ensureRegistered();
		return this.collectClass<T>(key);
	}

	methods<T>(key: MetadataKey): DecoratedMethod<T>[] {
		this.ensureRegistered();
		return this.collectMembers<T, DecoratedMethod<T>>(key, "method", true);
	}

	properties<T>(key: MetadataKey): DecoratedProperty<T>[] {
		this.ensureRegistered();
		return this.collectMembers<T, DecoratedProperty<T>>(key, "property", false);
	}

	private collectClass<T>(key: MetadataKey): DecoratedClass<T> | undefined {
		const list = collectClassMeta<T>(this.ctor, key);
		if (list.length === 0) {
			return;
		}
		return {
			kind: "class",
			name: targetDisplayName(this.ctor),
			metadata: list,
			target: this.ctor,
		};
	}

	private collectMembers<T, R extends DecoratedMethod<T> | DecoratedProperty<T>>(
		key: MetadataKey,
		kind: "method" | "property",
		wantMethod: boolean
	): R[] {
		const names = collectMemberNames(this.ctor, key);
		const out: R[] = [];
		for (const name of names) {
			const isStatic = getMemberStatic(this.ctor, name);
			if (this.isMethod(name, isStatic) !== wantMethod) {
				continue;
			}
			out.push({
				kind,
				name,
				static: isStatic,
				metadata: collectMemberMeta<T>(this.ctor, key, name),
			} as unknown as R);
		}
		return out;
	}

	private isMethod(name: string | symbol, isStatic: boolean): boolean {
		const cached = this.methodLikeCache.get(name);
		if (cached !== undefined) {
			return cached;
		}
		const result = isMethodLike(this.ctor, name, isStatic);
		this.methodLikeCache.set(name, result);
		return result;
	}

	private ensureRegistered(): void {
		if (this.registered) {
			return;
		}
		prepare(this.ctor);
		if (!(hasAnyClassMeta(this.ctor) || hasAnyMemberMeta(this.ctor))) {
			throw new UnregisteredClassError(this.ctor);
		}
		this.registered = true;
	}
}

/**
 * Returns a reflector for the class of `target` (instances resolve to their
 * constructor). Call {@link prepare} on the class earlier if the decoration
 * might not yet be registered (e.g. instance-only classes without a class decorator).
 */
export function reflect(target: object): Reflector {
	return new ReflectorImpl(resolveReflectTarget(target));
}
