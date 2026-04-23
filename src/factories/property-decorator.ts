import { resolveDeclaringClass } from "../metadata/declaring-class";
import { appendMemberMeta, collectMemberMeta, hasOwnMemberMeta, queueDeferred, registerCtor } from "../metadata/store";
import { resolveReflectTarget } from "../reflector/resolve-instance";
import { createScopedReflector } from "../reflector/scoped-reflector";
import { materialize } from "../runtime/materialize";
import { compose, ensureClassRegistered, generateKey, labelFor, throwMissingMember } from "./shared";
import type { DecoratedPropertyFactory, DecoratorOptions } from "./types";

// biome-ignore lint/complexity/noBannedTypes: constructor identity uses Function for parity with metadata/store
type Ctor = Function;

/**
 * Create a typed field decorator. `TField` constrains the declared type of the
 * decorated field — `createPropertyDecorator<M, [M], number>()` rejects
 * `@Dec() flag!: boolean;` at compile time via the structural assignability of
 * `ClassFieldDecoratorContext<This, Value>`.
 *
 * Field decorators register lazily on first instantiation. For pre-instantiation
 * reflection on instance-member-only classes, call `materialize(ctor)` first or
 * apply a class decorator (which drains the pending buffer at class-body eval).
 */
export function createPropertyDecorator<TMeta, TArgs extends unknown[] = [TMeta], TField = unknown>(
	options?: DecoratorOptions<TMeta, TArgs>
): DecoratedPropertyFactory<TMeta, TArgs, TField> {
	const key = generateKey(options?.name);
	const { compose: composeFn, name, unique = false } = options ?? {};
	const label = labelFor(name, key);

	const decoratorFn =
		(...args: TArgs) =>
		// biome-ignore lint/suspicious/noExplicitAny: EA-3 — ClassFieldDecoratorContext's This generic must default to `any` so typed `this:` on fields type-checks
		(_value: undefined, context: ClassFieldDecoratorContext<any, TField>): void => {
			const meta = compose(args, composeFn);
			const token = Symbol("propertyDecoration");
			const correlation = context.metadata;
			const memberName = context.name;
			const isStatic = context.static;

			queueDeferred(correlation, {
				key,
				name: memberName,
				meta,
				token,
				unique,
				static: isStatic,
				kind: "property",
			});

			context.addInitializer(function (this: unknown) {
				const ctor = resolveDeclaringClass(this as object, correlation);
				registerCtor(ctor, correlation);
				appendMemberMeta(ctor, key, memberName, meta, token, { unique, static: isStatic, kind: "property" });
			});
		};

	const firstMemberMeta = (ctor: Ctor, member: string | symbol): TMeta | undefined => {
		const list = collectMemberMeta<TMeta>(ctor, key, member);
		return list.length > 0 ? list[0] : undefined;
	};

	return Object.assign(decoratorFn, {
		key,
		reflect: (target: object) => createScopedReflector<TMeta>(resolveReflectTarget(target), key),
		metadata: (target: object, member: string | symbol) => {
			const ctor = resolveReflectTarget(target);
			materialize(ctor);
			ensureClassRegistered(ctor);
			return firstMemberMeta(ctor, member);
		},
		requireMetadata: (target: object, member: string | symbol): TMeta => {
			const ctor = resolveReflectTarget(target);
			materialize(ctor);
			ensureClassRegistered(ctor);
			const first = firstMemberMeta(ctor, member);
			return first === undefined ? throwMissingMember(key, "property", ctor, member, label) : first;
		},
		applied: (target: object, member: string | symbol) => {
			const ctor = resolveReflectTarget(target);
			materialize(ctor);
			return collectMemberMeta<TMeta>(ctor, key, member).length > 0;
		},
		appliedOwn: (target: object, member: string | symbol) => {
			const ctor = resolveReflectTarget(target);
			materialize(ctor);
			return hasOwnMemberMeta(ctor, key, member);
		},
	}) as DecoratedPropertyFactory<TMeta, TArgs, TField>;
}
