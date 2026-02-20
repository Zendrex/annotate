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

/** Applies the compose function if provided, otherwise uses the first arg as metadata. */
function compose<TMeta, TArgs extends unknown[]>(args: TArgs, fn?: (...a: TArgs) => TMeta): TMeta {
	// Type assertion safe: when no compose fn, the caller's type signature guarantees args[0] is TMeta
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

/** Converts a data property to an accessor descriptor backed by a WeakMap. */
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
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 * @param composeFn - Optional function to compose decorator arguments into metadata.
 *   If not provided, the first argument is used as the metadata value directly.
 * @returns A {@link DecoratedClassFactory} with reflection methods (`reflect`, `class`, `key`)
 *
 * @example
 * ```typescript
 * // Simple - direct metadata (first argument becomes metadata)
 * const Tag = createClassDecorator<string>();
 *
 * \@Tag("admin")
 * class AdminController {}
 *
 * // Compose - transform multiple arguments into structured metadata
 * const Role = createClassDecorator((name: string, level: number) => ({ name, level }));
 *
 * \@Role("moderator", 5)
 * class ModeratorController {}
 *
 * // Reflection - query decorated classes
 * const tags = Tag.class(AdminController);
 * // => [{ kind: "class", name: "AdminController", metadata: ["admin"], target: AdminController }]
 * ```
 */
export function createClassDecorator<TMeta, TArgs extends unknown[] = [TMeta]>(
	composeFn?: (...args: TArgs) => TMeta
): DecoratedClassFactory<TMeta, TArgs> {
	const key = generateKey();

	const decoratorFn =
		(...args: TArgs) =>
		(target: object): void => {
			appendMetadata(key, target, compose(args, composeFn));
		};

	// Type assertion safe: Object.assign merges the decorator fn with reflection methods,
	// matching the DecoratedClassFactory intersection type
	return Object.assign(decoratorFn, {
		key,
		reflect: (target: AnyConstructor): ScopedReflector<TMeta> => createScopedReflector(target, key),
		class: (target: AnyConstructor) => createScopedReflector<TMeta>(target, key).class(),
	}) as DecoratedClassFactory<TMeta, TArgs>;
}

/**
 * Creates a method decorator factory that stores metadata per method.
 *
 * Applicable to both instance and static methods.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 * @param composeFn - Optional function to compose decorator arguments into metadata.
 *   If not provided, the first argument is used as the metadata value directly.
 * @returns A {@link DecoratedMethodFactory} with reflection methods (`reflect`, `methods`, `key`)
 *
 * @example
 * ```typescript
 * // Simple - direct metadata (first argument becomes metadata)
 * const Route = createMethodDecorator<string>();
 *
 * class Api {
 *   \@Route("/users")
 *   getUsers() {}
 * }
 *
 * // Compose - transform multiple arguments into structured metadata
 * const Route = createMethodDecorator((path: string, method: "GET" | "POST") => ({ path, method }));
 *
 * class Api {
 *   \@Route("/users", "GET")
 *   getUsers() {}
 * }
 *
 * // Reflection - query decorated methods
 * const routes = Route.methods(Api);
 * // => [{ kind: "method", name: "getUsers", metadata: [{ path: "/users", method: "GET" }], target: fn }]
 * ```
 */
export function createMethodDecorator<TMeta, TArgs extends unknown[] = [TMeta]>(
	composeFn?: (...args: TArgs) => TMeta
): DecoratedMethodFactory<TMeta, TArgs> {
	const key = generateKey();

	const decoratorFn =
		(...args: TArgs) =>
		(target: object, propertyKey: string | symbol): void => {
			appendMetadata(key, target, compose(args, composeFn), propertyKey);
		};

	// Type assertion safe: Object.assign merges the decorator fn with reflection methods,
	// matching the DecoratedMethodFactory intersection type
	return Object.assign(decoratorFn, {
		key,
		reflect: (target: AnyConstructor): ScopedReflector<TMeta> => createScopedReflector(target, key),
		methods: (target: AnyConstructor) => createScopedReflector<TMeta>(target, key).methods(),
	}) as DecoratedMethodFactory<TMeta, TArgs>;
}

/**
 * Creates a property decorator factory that stores metadata on fields.
 *
 * Applicable to both instance and static properties. Properties are defined on the
 * prototype with `undefined` so the {@link Reflector} can discover them via
 * `Object.getOwnPropertyNames`.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 * @param composeFn - Optional function to compose decorator arguments into metadata.
 *   If not provided, the first argument is used as the metadata value directly.
 * @returns A {@link DecoratedPropertyFactory} with reflection methods (`reflect`, `properties`, `key`)
 *
 * @example
 * ```typescript
 * // Simple - direct metadata (first argument becomes metadata)
 * const Column = createPropertyDecorator<string>();
 *
 * class User {
 *   \@Column("varchar")
 *   name!: string;
 * }
 *
 * // Compose - transform multiple arguments into structured metadata
 * const Column = createPropertyDecorator((type: string, nullable: boolean) => ({ type, nullable }));
 *
 * class User {
 *   \@Column("varchar", false)
 *   name!: string;
 * }
 *
 * // Reflection - query decorated properties
 * const columns = Column.properties(User);
 * // => [{ kind: "property", name: "name", metadata: [{ type: "varchar", nullable: false }] }]
 * ```
 */
export function createPropertyDecorator<TMeta, TArgs extends unknown[] = [TMeta]>(
	composeFn?: (...args: TArgs) => TMeta
): DecoratedPropertyFactory<TMeta, TArgs> {
	const key = generateKey();

	const decoratorFn =
		(...args: TArgs) =>
		(target: object, propertyKey: string | symbol): void => {
			appendMetadata(key, target, compose(args, composeFn), propertyKey);
			ensureProperty(target, propertyKey);
		};

	// Type assertion safe: Object.assign merges the decorator fn with reflection methods,
	// matching the DecoratedPropertyFactory intersection type
	return Object.assign(decoratorFn, {
		key,
		reflect: (target: AnyConstructor): ScopedReflector<TMeta> => createScopedReflector(target, key),
		properties: (target: AnyConstructor) => createScopedReflector<TMeta>(target, key).properties(),
	}) as DecoratedPropertyFactory<TMeta, TArgs>;
}

/**
 * Creates a parameter decorator factory that stores metadata per parameter.
 *
 * Tracks the parameter index and stores metadata keyed by that index.
 * Multiple decorators on the same parameter accumulate in application order.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 * @param composeFn - Optional function to compose decorator arguments into metadata.
 *   If not provided, the first argument is used as the metadata value directly.
 * @returns A {@link DecoratedParameterFactory} with reflection methods (`reflect`, `parameters`, `key`)
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
	composeFn?: (...args: TArgs) => TMeta
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

	// Type assertion safe: Object.assign merges the decorator fn with reflection methods,
	// matching the DecoratedParameterFactory intersection type
	return Object.assign(decoratorFn, {
		key,
		reflect: (target: AnyConstructor): ScopedReflector<TMeta> => createScopedReflector(target, key),
		parameters: (target: AnyConstructor) => createScopedReflector<TMeta>(target, key).parameters(),
	}) as DecoratedParameterFactory<TMeta, TArgs>;
}

/**
 * Creates a method decorator that wraps the original method with an interceptor.
 *
 * Unlike {@link createMethodDecorator}, this factory actively modifies method
 * behavior at decoration time for cross-cutting concerns like logging, timing,
 * caching, or validation.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 * @param options - {@link MethodInterceptorOptions} with `interceptor` and optional `compose`
 * @returns A {@link DecoratedMethodFactory} with reflection methods (`reflect`, `methods`, `key`)
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
 *   \@Timed("operation")
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
	options: MethodInterceptorOptions<TMeta, TArgs>
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

	// Type assertion safe: Object.assign merges the decorator fn with reflection methods,
	// matching the DecoratedMethodFactory intersection type
	return Object.assign(decoratorFn, {
		key,
		reflect: (target: AnyConstructor): ScopedReflector<TMeta> => createScopedReflector(target, key),
		methods: (target: AnyConstructor) => createScopedReflector<TMeta>(target, key).methods(),
	}) as DecoratedMethodFactory<TMeta, TArgs>;
}

/**
 * Creates a property decorator that intercepts get/set operations.
 *
 * Properties are converted to accessor descriptors (get/set) if they aren't
 * already, enabling lazy initialization, validation, or change tracking.
 *
 * @typeParam TMeta - The type of metadata stored by the decorator
 * @typeParam TArgs - The argument types accepted by the decorator factory (defaults to `[TMeta]`)
 * @param options - {@link PropertyInterceptorOptions} with optional `onGet`, `onSet`, and `compose`
 * @returns A {@link DecoratedPropertyFactory} with reflection methods (`reflect`, `properties`, `key`)
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
 *   \@Observable("count")
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
	options: PropertyInterceptorOptions<TMeta, TArgs>
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

			// Type assertion safe: toAccessor() guarantees an accessor descriptor with get/set
			if (onGet && descriptor.get) {
				descriptor.get = onGet(descriptor.get as PropertyGetter, metadata, context);
			}

			if (onSet && descriptor.set) {
				descriptor.set = onSet(descriptor.set as PropertySetter, metadata, context);
			}

			Object.defineProperty(target, propertyKey, descriptor);
		};

	// Type assertion safe: Object.assign merges the decorator fn with reflection methods,
	// matching the DecoratedPropertyFactory intersection type
	return Object.assign(decoratorFn, {
		key,
		reflect: (target: AnyConstructor): ScopedReflector<TMeta> => createScopedReflector(target, key),
		properties: (target: AnyConstructor) => createScopedReflector<TMeta>(target, key).properties(),
	}) as DecoratedPropertyFactory<TMeta, TArgs>;
}
