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

function compose<TMeta, TArgs extends unknown[]>(args: TArgs, fn?: (...a: TArgs) => TMeta): TMeta {
	return fn ? fn(...args) : (args[0] as TMeta);
}

/**
 * Generate a unique symbol key.
 */
let keyCounter = 0;
function generateKey(): MetadataKey {
	keyCounter += 1;
	return Symbol(`decorator:${keyCounter}`);
}

/**
 * Ensure a property key exists on the target so reflection can find it.
 */
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

/**
 * Creates a class decorator factory that stores metadata on the class.
 *
 * This factory generates decorators for marking classes with typed metadata.
 * The returned factory function creates decorators that can be applied to
 * class declarations. Metadata is stored using `reflect-metadata` and can
 * be retrieved via the attached reflection methods or the global {@link Reflector}.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 *
 * @param composeFn - Optional function to compose decorator arguments into metadata.
 *   If not provided, the first argument is used as the metadata value directly.
 *
 * @returns A {@link DecoratedClassFactory} that creates class decorators and provides
 *   reflection methods (`reflect`, `class`, `key`) for querying decorated classes.
 *
 * @see {@link DecoratedClassFactory}
 * @see {@link ScopedReflector}
 *
 * @example
 * ```typescript
 * // Simple - direct metadata (first argument becomes metadata)
 * const Tag = createClassDecorator<string>();
 *
 * @Tag("admin")
 * class AdminController {}
 *
 * // Compose - transform multiple arguments into structured metadata
 * const Role = createClassDecorator((name: string, level: number) => ({ name, level }));
 *
 * @Role("moderator", 5)
 * class ModeratorController {}
 *
 * // Reflection - query decorated classes
 * const tags = Tag.class(AdminController);
 * // => [{ kind: "class", name: "AdminController", metadata: ["admin"], target: AdminController }]
 * ```
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

/**
 * Creates a method decorator factory that stores metadata per method.
 *
 * This factory generates decorators for annotating methods with typed metadata.
 * The returned factory function creates decorators that can be applied to both
 * instance and static methods. Metadata is stored using `reflect-metadata` and
 * can be retrieved via the attached reflection methods or the global {@link Reflector}.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 *
 * @param composeFn - Optional function to compose decorator arguments into metadata.
 *   If not provided, the first argument is used as the metadata value directly.
 *
 * @returns A {@link DecoratedMethodFactory} that creates method decorators and provides
 *   reflection methods (`reflect`, `methods`, `key`) for querying decorated methods.
 *
 * @see {@link DecoratedMethodFactory}
 * @see {@link ScopedReflector}
 *
 * @example
 * ```typescript
 * // Simple - direct metadata (first argument becomes metadata)
 * const Route = createMethodDecorator<string>();
 *
 * class Api {
 *   @Route("/users")
 *   getUsers() {}
 * }
 *
 * // Compose - transform multiple arguments into structured metadata
 * const Route = createMethodDecorator((path: string, method: "GET" | "POST") => ({ path, method }));
 *
 * class Api {
 *   @Route("/users", "GET")
 *   getUsers() {}
 * }
 *
 * // Reflection - query decorated methods
 * const routes = Route.methods(Api);
 * // => [{ kind: "method", name: "getUsers", metadata: [{ path: "/users", method: "GET" }], target: fn }]
 * ```
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

/**
 * Creates a property decorator factory that stores metadata on fields.
 *
 * This factory generates decorators for annotating class properties with typed metadata.
 * The returned factory function creates decorators that can be applied to both instance
 * and static properties. Properties are ensured to exist on the prototype for reflection
 * discovery. Metadata is stored using `reflect-metadata` and can be retrieved via the
 * attached reflection methods or the global {@link Reflector}.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 *
 * @param composeFn - Optional function to compose decorator arguments into metadata.
 *   If not provided, the first argument is used as the metadata value directly.
 *
 * @returns A {@link DecoratedPropertyFactory} that creates property decorators and provides
 *   reflection methods (`reflect`, `properties`, `key`) for querying decorated properties.
 *
 * @see {@link DecoratedPropertyFactory}
 * @see {@link ScopedReflector}
 *
 * @example
 * ```typescript
 * // Simple - direct metadata (first argument becomes metadata)
 * const Column = createPropertyDecorator<string>();
 *
 * class User {
 *   @Column("varchar")
 *   name!: string;
 * }
 *
 * // Compose - transform multiple arguments into structured metadata
 * const Column = createPropertyDecorator((type: string, nullable: boolean) => ({ type, nullable }));
 *
 * class User {
 *   @Column("varchar", false)
 *   name!: string;
 * }
 *
 * // Reflection - query decorated properties
 * const columns = Column.properties(User);
 * // => [{ kind: "property", name: "name", metadata: [{ type: "varchar", nullable: false }] }]
 * ```
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

/**
 * Creates a parameter decorator factory that stores metadata per parameter.
 *
 * This factory generates decorators for annotating constructor and method parameters
 * with typed metadata. The returned factory function creates decorators that track
 * the parameter index and store metadata keyed by that index. Multiple decorators
 * on the same parameter accumulate their metadata in application order. Metadata
 * is stored using `reflect-metadata` and can be retrieved via the attached reflection
 * methods or the global {@link Reflector}.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 *
 * @param composeFn - Optional function to compose decorator arguments into metadata.
 *   If not provided, the first argument is used as the metadata value directly.
 *
 * @returns A {@link DecoratedParameterFactory} that creates parameter decorators and provides
 *   reflection methods (`reflect`, `parameters`, `key`) for querying decorated parameters.
 *
 * @see {@link DecoratedParameterFactory}
 * @see {@link ScopedReflector}
 *
 * @example
 * ```typescript
 * // Simple - direct metadata (first argument becomes metadata)
 * const Inject = createParameterDecorator<string>();
 *
 * class Service {
 *   constructor(@Inject("db") db: Database) {}
 * }
 *
 * // Compose - transform multiple arguments into structured metadata
 * const Inject = createParameterDecorator((token: string, optional: boolean) => ({ token, optional }));
 *
 * class Service {
 *   constructor(@Inject("db", false) db: Database) {}
 * }
 *
 * // Reflection - query decorated parameters
 * const params = Inject.parameters(Service);
 * // => [{ kind: "parameter", name: "constructor", parameterIndex: 0, metadata: [{ token: "db", optional: false }] }]
 * ```
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

/**
 * Creates a method decorator that wraps the original method with an interceptor.
 *
 * This factory generates decorators that wrap method implementations, enabling
 * cross-cutting concerns like logging, timing, caching, or validation. The
 * interceptor receives the original method, accumulated metadata, and context
 * about the decoration target. Unlike {@link createMethodDecorator}, this factory
 * actively modifies method behavior at decoration time.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 *
 * @param options - Configuration for the method interceptor, including:
 *   - `compose`: Optional function to transform decorator arguments into metadata
 *   - `interceptor`: Function that receives the original method and returns a wrapped version
 *
 * @returns A {@link DecoratedMethodFactory} that creates method decorators with interception
 *   and provides reflection methods (`reflect`, `methods`, `key`) for querying decorated methods.
 *
 * @see {@link MethodInterceptorOptions}
 * @see {@link DecoratedMethodFactory}
 *
 * @example
 * ```typescript
 * // Create a timing decorator
 * const Timed = createMethodInterceptor<string>({
 *   interceptor: (original, meta, ctx) => function(...args) {
 *     const start = Date.now();
 *     const result = original.apply(this, args);
 *     console.log(`${String(ctx.propertyKey)} took ${Date.now() - start}ms`);
 *     return result;
 *   }
 * });
 *
 * class Service {
 *   @Timed("operation")
 *   expensiveOperation() {
 *     // ... slow work
 *   }
 * }
 *
 * // Reflection - query decorated methods
 * const timed = Timed.methods(Service);
 * // => [{ kind: "method", name: "expensiveOperation", metadata: ["operation"], target: fn }]
 * ```
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

/**
 * Creates a property decorator that intercepts get/set operations.
 *
 * This factory generates decorators that wrap property access, enabling
 * features like lazy initialization, validation, change tracking, or
 * computed properties. The interceptors receive the original getter/setter,
 * accumulated metadata, and context about the decoration target. Properties
 * are converted to accessor descriptors (get/set) if they aren't already.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 *
 * @param options - Configuration for the property interceptor, including:
 *   - `compose`: Optional function to transform decorator arguments into metadata
 *   - `onGet`: Optional interceptor for property reads
 *   - `onSet`: Optional interceptor for property writes
 *
 * @returns A {@link DecoratedPropertyFactory} that creates property decorators with interception
 *   and provides reflection methods (`reflect`, `properties`, `key`) for querying decorated properties.
 *
 * @see {@link PropertyInterceptorOptions}
 * @see {@link DecoratedPropertyFactory}
 *
 * @example
 * ```typescript
 * // Create an observable property decorator
 * const Observable = createPropertyInterceptor<string>({
 *   onSet: (original, meta, ctx) => function(value) {
 *     console.log(`${String(ctx.propertyKey)} changed to ${value}`);
 *     original.call(this, value);
 *   }
 * });
 *
 * class Store {
 *   @Observable("count")
 *   count = 0;
 * }
 *
 * const store = new Store();
 * store.count = 5; // logs: "count changed to 5"
 *
 * // Reflection - query decorated properties
 * const observed = Observable.properties(Store);
 * // => [{ kind: "property", name: "count", metadata: ["count"] }]
 * ```
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
