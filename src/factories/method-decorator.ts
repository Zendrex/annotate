import { resolveDeclaringClass } from "../metadata/declaring-class";
import {
	appendMemberMeta,
	collectMemberMeta,
	flushFor,
	hasOwnMemberMeta,
	queueDeferred,
	registerCtor,
} from "../metadata/store";
import { resolveReflectTarget } from "../reflector/resolve-instance";
import { createScopedReflector } from "../reflector/scoped-reflector";
import { materialize } from "../runtime/materialize";
import { compose, ensureClassRegistered, generateKey, labelFor, throwMissingMember } from "./shared";
import type { AnyFn, DecoratedMethodFactory, DecoratorOptions } from "./types";

// biome-ignore lint/complexity/noBannedTypes: Constructor identity uses Function for parity with metadata/store module.
type Ctor = Function;

export function createMethodDecorator<TMeta, TArgs extends unknown[] = [TMeta], TMethod extends AnyFn = AnyFn>(
	options?: DecoratorOptions<TMeta, TArgs>
): DecoratedMethodFactory<TMeta, TArgs, TMethod> {
	const key = generateKey(options?.name);
	const { compose: composeFn, name, unique = false } = options ?? {};
	const label = labelFor(name, key);

	const decoratorFn =
		(...args: TArgs) =>
		// biome-ignore lint/suspicious/noExplicitAny: EA-3 — ClassMethodDecoratorContext's This generic must default to `any` so typed `this:` on methods type-checks
		(_value: TMethod, context: ClassMethodDecoratorContext<any, TMethod>): void => {
			const meta = compose(args, composeFn);
			const token = Symbol("methodDecoration");
			const correlation = context.metadata;
			const memberName = context.name;
			const isStatic = context.static;

			if (isStatic) {
				context.addInitializer(function (this: unknown) {
					const ctor = this as Ctor;
					appendMemberMeta(ctor, key, memberName, meta, token, { unique, static: true, kind: "method" });
					registerCtor(ctor, correlation);
					flushFor(ctor, correlation);
				});
				return;
			}

			queueDeferred(correlation, { key, name: memberName, meta, token, unique, static: false, kind: "method" });

			context.addInitializer(function (this: unknown) {
				const ctor = resolveDeclaringClass(this as object, correlation);
				registerCtor(ctor, correlation);
				appendMemberMeta(ctor, key, memberName, meta, token, { unique, static: false, kind: "method" });
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
			return first === undefined ? throwMissingMember(key, "method", ctor, member, label) : first;
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
	}) as DecoratedMethodFactory<TMeta, TArgs, TMethod>;
}
