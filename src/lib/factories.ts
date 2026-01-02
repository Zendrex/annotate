import type {
	AnyConstructor,
	DecoratedClassFactory,
	DecoratedMethodFactory,
	DecoratedParameterFactory,
	DecoratedPropertyFactory,
	MetadataKey,
	MethodInterceptorOptions,
	PropertyGetter,
	PropertyInterceptorOptions,
	PropertySetter,
	ScopedReflector,
} from "./types";

import { appendMetadata, getMetadataArray, getParameterMap, setParameterMap } from "./metadata";
import { createScopedReflector } from "./reflector";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function compose<TMeta, TArgs extends unknown[]>(args: TArgs, fn?: (...a: TArgs) => TMeta): TMeta {
	return fn ? fn(...args) : (args[0] as TMeta);
}

/** Generate a unique symbol key. */
let keyCounter = 0;
function generateKey(): MetadataKey {
	keyCounter += 1;
	return Symbol(`decorator:${keyCounter}`);
}

/** Ensure a property key exists on the target so reflection can find it. */
function ensureProperty(target: object, key: string | symbol): void {
	if (Object.hasOwn(target, key)) {
		return;
	}
	Object.defineProperty(target, key, {
		configurable: true,
		enumerable: false,
		writable: true,
		value: undefined,
	});
}

function toAccessor(target: object, key: string | symbol): PropertyDescriptor {
	const desc = Object.getOwnPropertyDescriptor(target, key);

	// Already an accessor
	if (desc?.get || desc?.set) {
		return {
			configurable: true,
			enumerable: false,
			get: desc.get,
			set: desc.set,
		};
	}

	// Convert data property to accessor with WeakMap backing
	const store = new WeakMap<object, unknown>();
	if (desc && "value" in desc && desc.value !== undefined) {
		store.set(target, desc.value);
	}

	const accessor: PropertyDescriptor = {
		configurable: true,
		enumerable: false,
		get(this: object) {
			return store.get(this);
		},
		set(this: object, value: unknown) {
			store.set(this, value);
		},
	};

	Object.defineProperty(target, key, accessor);
	return accessor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Class Decorator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a class decorator factory that stores metadata on the class.
 *
 * @example
 * // Simple - direct metadata
 * const Tag = createClassDecorator<string>();
 *
 * // Compose - inferred types from function args
 * const Role = createClassDecorator((name: string, level: number) => ({ name, level }));
 *
 * @Tag("admin")
 * class AdminController {}
 *
 * // Reflection
 * const tags = Tag.class(AdminController);
 */
export function createClassDecorator<TMeta, TArgs extends unknown[] = [TMeta]>(
	composeFn?: (...args: TArgs) => TMeta,
): DecoratedClassFactory<TMeta, TArgs> {
	const key = generateKey();

	const decoratorFn =
		(...args: TArgs) =>
		(target: object): void => {
			appendMetadata(key, target, compose(args, composeFn));
		};

	return Object.assign(decoratorFn, {
		key,
		reflect: (target: AnyConstructor): ScopedReflector<TMeta> => createScopedReflector(target, key),
		class: (target: AnyConstructor) => createScopedReflector<TMeta>(target, key).class(),
	}) as DecoratedClassFactory<TMeta, TArgs>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Method Decorator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a method decorator factory that stores metadata per method.
 *
 * @example
 * // Simple - direct metadata
 * const Route = createMethodDecorator<string>();
 *
 * // Compose - inferred types from function args
 * const Route = createMethodDecorator((path: string, method: "GET" | "POST") => ({ path, method }));
 *
 * class Api {
 *   @Route("/users", "GET")
 *   getUsers() {}
 * }
 *
 * // Reflection
 * const routes = Route.methods(Api);
 */
export function createMethodDecorator<TMeta, TArgs extends unknown[] = [TMeta]>(
	composeFn?: (...args: TArgs) => TMeta,
): DecoratedMethodFactory<TMeta, TArgs> {
	const key = generateKey();

	const decoratorFn =
		(...args: TArgs) =>
		(target: object, propertyKey: string | symbol): void => {
			appendMetadata(key, target, compose(args, composeFn), propertyKey);
		};

	return Object.assign(decoratorFn, {
		key,
		reflect: (target: AnyConstructor): ScopedReflector<TMeta> => createScopedReflector(target, key),
		methods: (target: AnyConstructor) => createScopedReflector<TMeta>(target, key).methods(),
	}) as DecoratedMethodFactory<TMeta, TArgs>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Property Decorator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a property decorator factory that stores metadata on fields.
 *
 * @example
 * // Simple - direct metadata
 * const Column = createPropertyDecorator<string>();
 *
 * // Compose - inferred types from function args
 * const Column = createPropertyDecorator((type: string, nullable: boolean) => ({ type, nullable }));
 *
 * class User {
 *   @Column("varchar", false)
 *   name!: string;
 * }
 *
 * // Reflection
 * const columns = Column.properties(User);
 */
export function createPropertyDecorator<TMeta, TArgs extends unknown[] = [TMeta]>(
	composeFn?: (...args: TArgs) => TMeta,
): DecoratedPropertyFactory<TMeta, TArgs> {
	const key = generateKey();

	const decoratorFn =
		(...args: TArgs) =>
		(target: object, propertyKey: string | symbol): void => {
			appendMetadata(key, target, compose(args, composeFn), propertyKey);
			ensureProperty(target, propertyKey);
		};

	return Object.assign(decoratorFn, {
		key,
		reflect: (target: AnyConstructor): ScopedReflector<TMeta> => createScopedReflector(target, key),
		properties: (target: AnyConstructor) => createScopedReflector<TMeta>(target, key).properties(),
	}) as DecoratedPropertyFactory<TMeta, TArgs>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parameter Decorator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a parameter decorator factory that stores metadata per parameter.
 *
 * @example
 * // Simple - direct metadata
 * const Inject = createParameterDecorator<string>();
 *
 * // Compose - inferred types from function args
 * const Inject = createParameterDecorator((token: string, optional: boolean) => ({ token, optional }));
 *
 * class Service {
 *   constructor(@Inject("db", false) db: Database) {}
 * }
 *
 * // Reflection
 * const params = Inject.parameters(Service);
 */
export function createParameterDecorator<TMeta, TArgs extends unknown[] = [TMeta]>(
	composeFn?: (...args: TArgs) => TMeta,
): DecoratedParameterFactory<TMeta, TArgs> {
	const key = generateKey();

	const decoratorFn =
		(...args: TArgs) =>
		(target: object, propertyKey: string | symbol | undefined, parameterIndex: number): void => {
			const map = getParameterMap<TMeta>(key, target, propertyKey);
			const existing = map.get(parameterIndex) ?? [];
			existing.push(compose(args, composeFn));
			map.set(parameterIndex, existing);
			setParameterMap(key, target, map, propertyKey);
		};

	return Object.assign(decoratorFn, {
		key,
		reflect: (target: AnyConstructor): ScopedReflector<TMeta> => createScopedReflector(target, key),
		parameters: (target: AnyConstructor) => createScopedReflector<TMeta>(target, key).parameters(),
	}) as DecoratedParameterFactory<TMeta, TArgs>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Method Interceptor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a method decorator that wraps the original method.
 *
 * @example
 * const Timed = createMethodInterceptor<string>({
 *   interceptor: (original, meta, ctx) => function(...args) {
 *     const start = Date.now();
 *     const result = original.apply(this, args);
 *     console.log(`${ctx.propertyKey} took ${Date.now() - start}ms`);
 *     return result;
 *   }
 * });
 *
 * // Reflection
 * const timed = Timed.methods(Service);
 */
export function createMethodInterceptor<TMeta, TArgs extends unknown[] = [TMeta]>(
	options: MethodInterceptorOptions<TMeta, TArgs>,
): DecoratedMethodFactory<TMeta, TArgs> {
	const key = generateKey();
	const { compose: composeFn, interceptor } = options;

	const decoratorFn =
		(...args: TArgs) =>
		(target: object, propertyKey: string | symbol, descriptor?: PropertyDescriptor): void => {
			appendMetadata(key, target, compose(args, composeFn), propertyKey);

			if (!descriptor || typeof descriptor.value !== "function") {
				return;
			}

			const original = descriptor.value;
			const metadata = getMetadataArray<TMeta>(key, target, propertyKey);
			const wrapped = interceptor(original, metadata, {
				target,
				propertyKey,
				descriptor,
			});

			Object.defineProperty(wrapped, "name", {
				value: original.name,
				configurable: true,
			});
			descriptor.value = wrapped;
		};

	return Object.assign(decoratorFn, {
		key,
		reflect: (target: AnyConstructor): ScopedReflector<TMeta> => createScopedReflector(target, key),
		methods: (target: AnyConstructor) => createScopedReflector<TMeta>(target, key).methods(),
	}) as DecoratedMethodFactory<TMeta, TArgs>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Property Interceptor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a property decorator that intercepts get/set operations.
 *
 * @example
 * const Observable = createPropertyInterceptor<string>({
 *   onSet: (original, meta, ctx) => function(value) {
 *     console.log(`${ctx.propertyKey} = ${value}`);
 *     original.call(this, value);
 *   }
 * });
 *
 * // Reflection
 * const observed = Observable.properties(Store);
 */
export function createPropertyInterceptor<TMeta, TArgs extends unknown[] = [TMeta]>(
	options: PropertyInterceptorOptions<TMeta, TArgs>,
): DecoratedPropertyFactory<TMeta, TArgs> {
	const key = generateKey();
	const { compose: composeFn, onGet, onSet } = options;

	const decoratorFn =
		(...args: TArgs) =>
		(target: object, propertyKey: string | symbol): void => {
			appendMetadata(key, target, compose(args, composeFn), propertyKey);

			if (!(onGet || onSet)) {
				return;
			}

			const descriptor = toAccessor(target, propertyKey);
			const metadata = getMetadataArray<TMeta>(key, target, propertyKey);
			const context = { target, propertyKey, descriptor };

			if (onGet && descriptor.get) {
				descriptor.get = onGet(descriptor.get as PropertyGetter, metadata, context);
			}

			if (onSet && descriptor.set) {
				descriptor.set = onSet(descriptor.set as PropertySetter, metadata, context);
			}

			Object.defineProperty(target, propertyKey, descriptor);
		};

	return Object.assign(decoratorFn, {
		key,
		reflect: (target: AnyConstructor): ScopedReflector<TMeta> => createScopedReflector(target, key),
		properties: (target: AnyConstructor) => createScopedReflector<TMeta>(target, key).properties(),
	}) as DecoratedPropertyFactory<TMeta, TArgs>;
}
