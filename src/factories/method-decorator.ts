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
import { compose, generateKey, labelFor, throwMissingMember } from "./shared";
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
		(_value: TMethod, context: ClassMethodDecoratorContext<unknown, TMethod>): void => {
			const meta = compose(args, composeFn);
			const token = Symbol("methodDecoration");
			const correlation = context.metadata;
			const memberName = context.name;

			if (context.static) {
				context.addInitializer(function (this: unknown) {
					const ctor = this as Ctor;
					appendMemberMeta(ctor, key, memberName, meta, token, { unique });
					registerCtor(ctor, correlation);
					flushFor(ctor, correlation);
				});
				return;
			}

			queueDeferred(correlation, { key, name: memberName, meta, token, unique });

			context.addInitializer(function (this: unknown) {
				const ctor = resolveDeclaringClass(this as object, correlation);
				registerCtor(ctor, correlation);
				appendMemberMeta(ctor, key, memberName, meta, token, { unique });
			});
		};

	const firstMemberMeta = (ctor: Ctor, member: string | symbol): TMeta | undefined => {
		const list = collectMemberMeta<TMeta>(ctor, key, member);
		return list.length > 0 ? list[0] : undefined;
	};

	return Object.assign(decoratorFn, {
		key,
		reflect: (target: object) => createScopedReflector<TMeta>(resolveReflectTarget(target), key),
		metadata: (target: object, member: string | symbol) => firstMemberMeta(resolveReflectTarget(target), member),
		requireMetadata: (target: object, member: string | symbol): TMeta => {
			const ctor = resolveReflectTarget(target);
			const first = firstMemberMeta(ctor, member);
			return first === undefined ? throwMissingMember(key, "method", ctor, member, label) : first;
		},
		applied: (target: object, member: string | symbol) =>
			collectMemberMeta<TMeta>(resolveReflectTarget(target), key, member).length > 0,
		appliedOwn: (target: object, member: string | symbol) =>
			hasOwnMemberMeta(resolveReflectTarget(target), key, member),
	}) as DecoratedMethodFactory<TMeta, TArgs, TMethod>;
}
