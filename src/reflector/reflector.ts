import { UnregisteredClassError } from "../errors";
import {
	collectClassMeta,
	collectMemberMeta,
	collectMemberNames,
	hasAnyClassMeta,
	hasAnyMemberMeta,
} from "../metadata/store";
import { materialize } from "../runtime/materialize";
import { targetDisplayName } from "./class-name";
import { resolveReflectTarget } from "./resolve-instance";
import type { MetadataKey } from "../metadata/types";
import type { AnyConstructor, DecoratedClass, DecoratedItem, DecoratedMethod, DecoratedProperty } from "./types";

// biome-ignore lint/complexity/noBannedTypes: constructor identity uses Function for parity with metadata/store
type Ctor = Function;

/**
 * Reflection over decorator metadata attached to a class. Each query takes a
 * {@link MetadataKey} so a single reflector can answer for multiple factories.
 *
 * Exposed as a type only — construct instances via {@link reflect}. For
 * single-factory usage prefer `factory.reflect(target)`, which returns a
 * scoped reflector pre-bound to that factory's key.
 */
export interface Reflector {
	all<T>(key: MetadataKey): DecoratedItem<T>[];
	class<T>(key: MetadataKey): DecoratedClass<T> | undefined;
	methods<T>(key: MetadataKey): DecoratedMethod<T>[];
	properties<T>(key: MetadataKey): DecoratedProperty<T>[];
}

function isMethodLike(ctor: Ctor, name: string | symbol): boolean {
	let current: object | null = ctor.prototype as object | null;
	while (current && current !== Object.prototype) {
		const desc = Object.getOwnPropertyDescriptor(current, name);
		if (desc) {
			return typeof desc.value === "function" || typeof desc.get === "function" || typeof desc.set === "function";
		}
		current = Object.getPrototypeOf(current);
	}
	const staticDesc = Object.getOwnPropertyDescriptor(ctor, name);
	if (staticDesc) {
		return (
			typeof staticDesc.value === "function" ||
			typeof staticDesc.get === "function" ||
			typeof staticDesc.set === "function"
		);
	}
	return false;
}

function isStaticMember(ctor: Ctor, name: string | symbol): boolean {
	return Object.hasOwn(ctor, name);
}

/** @internal */
export class ReflectorImpl implements Reflector {
	private readonly ctor: AnyConstructor;

	constructor(target: AnyConstructor) {
		this.ctor = target;
	}

	all<T>(key: MetadataKey): DecoratedItem<T>[] {
		const c = this.class<T>(key);
		return [...(c ? [c] : []), ...this.methods<T>(key), ...this.properties<T>(key)];
	}

	class<T>(key: MetadataKey): DecoratedClass<T> | undefined {
		this.ensureRegistered();
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

	methods<T>(key: MetadataKey): DecoratedMethod<T>[] {
		return this.collectMembers<T, DecoratedMethod<T>>(key, "method", true);
	}

	properties<T>(key: MetadataKey): DecoratedProperty<T>[] {
		return this.collectMembers<T, DecoratedProperty<T>>(key, "property", false);
	}

	private collectMembers<T, R extends DecoratedMethod<T> | DecoratedProperty<T>>(
		key: MetadataKey,
		kind: "method" | "property",
		wantMethod: boolean
	): R[] {
		this.ensureRegistered();
		const names = collectMemberNames(this.ctor, key);
		const out: R[] = [];
		for (const name of names) {
			const list = collectMemberMeta<T>(this.ctor, key, name);
			if (list.length === 0) {
				continue;
			}
			const isMethod = isMethodLike(this.ctor, name);
			if (wantMethod ? !isMethod : isMethod) {
				continue;
			}
			out.push({
				kind,
				name,
				static: isStaticMember(this.ctor, name),
				metadata: list,
			} as unknown as R);
		}
		return out;
	}

	private ensureRegistered(): void {
		materialize(this.ctor);
		if (!(hasAnyClassMeta(this.ctor) || hasAnyMemberMeta(this.ctor))) {
			throw new UnregisteredClassError(this.ctor);
		}
	}
}

/**
 * Create a {@link Reflector} for a class or instance. Auto-materializes pending
 * registrations on read; throws {@link UnregisteredClassError} when the class
 * has no annotate metadata anywhere on its prototype chain.
 *
 * Use `factory.applied(...)` / `factory.appliedOwn(...)` for defensive checks
 * over arbitrary classes — those never throw.
 *
 * @throws {TypeError} When `target` cannot be resolved to a concrete class constructor
 * @throws {UnregisteredClassError} When `target` has no registered metadata
 */
export function reflect(target: object): Reflector {
	return new ReflectorImpl(resolveReflectTarget(target));
}
