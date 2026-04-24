import { UnregisteredClassError } from "../errors";
import {
	collectClassMeta,
	collectMemberMeta,
	collectMemberNames,
	getMemberStatic,
	hasAnyClassMeta,
	hasAnyMemberMeta,
} from "../metadata/store";
import { materialize } from "../runtime/materialize";
import { targetDisplayName } from "./class-name";
import { resolveReflectTarget } from "./resolve-instance";
import type { Ctor, MetadataKey } from "../metadata/types";
import type { AnyConstructor, DecoratedClass, DecoratedItem, DecoratedMethod, DecoratedProperty } from "./types";

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

// Classify strictly by descriptor value: only plain function descriptors count
// as methods. Auto-accessors expose get/set on the prototype and are therefore
// reported as properties by design. `isStatic` is sourced from the store (set
// from `context.static` at decoration time) so built-in ctor properties like
// `name` / `length` never misclassify an instance field.
function isMethodLike(ctor: Ctor, name: string | symbol, isStatic: boolean): boolean {
	const target = isStatic ? (ctor as object) : (ctor.prototype as object);
	const desc = Object.getOwnPropertyDescriptor(target, name);
	if (!desc) {
		return false;
	}
	return typeof desc.value === "function";
}

/** @internal */
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
		materialize(this.ctor);
		if (!(hasAnyClassMeta(this.ctor) || hasAnyMemberMeta(this.ctor))) {
			throw new UnregisteredClassError(this.ctor);
		}
		this.registered = true;
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
