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
import type { AccessorInterceptorOptions, DecoratedAccessorFactory, InterceptorContext } from "./types";

// biome-ignore lint/complexity/noBannedTypes: Constructor identity uses Function for parity with metadata/store module.
type Ctor = Function;

/**
 * Create an accessor (get/set) interceptor. Supply `onGet`, `onSet`, or both;
 * calling with neither throws a `TypeError`. Each hook receives a
 * `readMetadata` reader that, when called at invocation time, returns the
 * full ancestor-merged metadata array for the decorated member.
 *
 * `TValue` constrains the accessor's declared type — narrowing it (e.g.
 * `number`) rejects applications to accessors with incompatible types at
 * compile time.
 *
 * Applies to both instance and static accessors. For instance accessors the
 * metadata registers lazily on first instantiation; static applications
 * register at class-body evaluation and drain the pending buffer.
 */
export function createAccessorInterceptor<TMeta, TArgs extends unknown[] = [TMeta], TValue = unknown>(
	options: AccessorInterceptorOptions<TMeta, TArgs, TValue>
): DecoratedAccessorFactory<TMeta, TArgs, TValue> {
	if (!(options.onGet || options.onSet)) {
		throw new TypeError("createAccessorInterceptor: provide at least one of onGet or onSet");
	}

	const key = generateKey(options.name);
	const { compose: composeFn, onGet, onSet, name, unique = false } = options;
	const label = labelFor(name, key);

	const decoratorFn =
		(...args: TArgs) =>
		(
			// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
			value: ClassAccessorDecoratorTarget<any, TValue>,
			// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
			context: ClassAccessorDecoratorContext<any, TValue>
			// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
		): ClassAccessorDecoratorResult<any, TValue> => {
			const meta = compose(args, composeFn);
			const token = Symbol("accessorIntercept");
			const correlation = context.metadata;
			const memberName = context.name;
			const isStatic = context.static;

			const interceptorContext: InterceptorContext = {
				name: memberName,
				static: isStatic,
				kind: "accessor",
			};

			const readMetadata = (instance: object): TMeta[] => {
				const ctor = isStatic ? (instance as unknown as Ctor) : (instance as { constructor: Ctor }).constructor;
				return collectMemberMeta<TMeta>(ctor, key, memberName);
			};

			// biome-ignore lint/suspicious/noExplicitAny: EA-3 — This defaults to any per lib.es2023.decorators.d.ts
			const result: ClassAccessorDecoratorResult<any, TValue> = {};
			if (onGet) {
				const wrappedGet = onGet(value.get, readMetadata, interceptorContext);
				result.get = wrappedGet;
			}
			if (onSet) {
				const wrappedSet = onSet(value.set, readMetadata, interceptorContext);
				result.set = wrappedSet;
			}

			if (isStatic) {
				context.addInitializer(function (this: unknown) {
					const ctor = this as Ctor;
					appendMemberMeta(ctor, key, memberName, meta, token, { unique, static: true, kind: "property" });
					registerCtor(ctor, correlation);
					flushFor(ctor, correlation);
				});
			} else {
				queueDeferred(correlation, {
					key,
					name: memberName,
					meta,
					token,
					unique,
					static: false,
					kind: "property",
				});
				context.addInitializer(function (this: unknown) {
					const ctor = resolveDeclaringClass(this as object, correlation);
					registerCtor(ctor, correlation);
					appendMemberMeta(ctor, key, memberName, meta, token, { unique, static: false, kind: "property" });
				});
			}

			return result;
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
	}) as DecoratedAccessorFactory<TMeta, TArgs, TValue>;
}
