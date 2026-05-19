import { mintMetadataKey } from "../metadata/cardinality-registry";
import { collectMemberMeta, collectMemberNames, getMemberStatic } from "../metadata/member-meta-store";
import { prepare } from "../runtime/prepare";
import { walkPrototypeChain } from "../runtime/prototype-chain";
import {
	compose,
	createMemberFactoryHelpers,
	emitMemberDecoration,
	mergeExtendedOptions,
	prepareFactoryShell,
} from "./shared";
import type { Cardinality, Ctor, MetadataKey } from "../metadata/types";
import type {
	DecoratedPropertyFactory,
	DecoratorOptions,
	DeriveOptions,
	FieldInterceptorOptions,
	InterceptorContext,
} from "./types";

/** @internal Hook bundle preserved by `derive` across factory rebuilds. */
export interface FieldHookRefs<TMeta, TField> {
	onInit: (initial: TField, readMetadata: (instance: object) => TMeta[], context: InterceptorContext) => TField;
}

/**
 * Module-global registry of every `intercept.field` factory. The instance
 * addInitializer body iterates this registry rather than capturing
 * per-decoration state, so it survives Bun 1.3's module-shared `var _init`
 * transformer bug where only the last-registered instance addInit fires.
 *
 * @internal
 */
const fieldInterceptors = new Map<MetadataKey, FieldHookRefs<unknown, unknown>>();

/**
 * Stage 3 class-field interceptor: registers metadata and replaces the field's
 * initial value with `onInit(initial, readMetadata, context)`.
 *
 * Unlike returning a value-replacement initializer from the field decorator
 * (which Bun 1.3 transpiles into a shared module-scope closure across every
 * decorated class), this factory performs the replacement from an
 * `addInitializer` body that resolves all work via `this.constructor` and a
 * module-global registry. The post-construction state is correct under Bun 1.3
 * and spec-conformant transpilers (esbuild / TS / SWC).
 *
 * @throws {TypeError} When `onInit` is missing.
 */
export function createFieldInterceptor<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TField = unknown,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(options: FieldInterceptorOptions<TMeta, TArgs, TField>): DecoratedPropertyFactory<TMeta, TArgs, TField, TThis> {
	requireFieldHook(options, "intercept.field");

	const key = mintMetadataKey<TMeta>("unique", options.name);
	const { onInit, ...rest } = options;
	return buildFieldFactory<TMeta, TArgs, TField, TThis>(key, rest as DecoratorOptions<TMeta, TArgs>, { onInit });
}

/** @internal Builds the factory against a pre-minted key; reused by `derive`. */
export function buildFieldFactory<TMeta, TArgs extends unknown[], TField, TThis, TCard extends Cardinality = "unique">(
	key: MetadataKey<TMeta, TCard>,
	options: DecoratorOptions<TMeta, TArgs> | undefined,
	hookRefs: FieldHookRefs<TMeta, TField>
): DecoratedPropertyFactory<TMeta, TArgs, TField, TThis, TCard> {
	const { composeFn, label, validators } = prepareFactoryShell<TMeta, TArgs>(key, options);
	const { onInit } = hookRefs;

	registerFieldInterceptor(key, hookRefs);

	const decoratorFn =
		(...args: TArgs) =>
		(_value: undefined, context: ClassFieldDecoratorContext<TThis, TField>): void => {
			emitMemberDecoration({
				context,
				key,
				kind: "property",
				meta: compose(args, composeFn),
				token: Symbol("fieldIntercept"),
				validators,
			});

			if (context.static) {
				const memberName = context.name;
				const readMetadata = makeStaticReader<TMeta>(key, memberName);
				const interceptorContext: InterceptorContext = { name: memberName, static: true, kind: "field" };
				context.addInitializer(function (this: unknown) {
					const ctor = this as Ctor;
					const target = ctor as unknown as Record<string | symbol, TField>;
					target[memberName] = onInit.call(
						target,
						target[memberName] as TField,
						readMetadata,
						interceptorContext
					);
				});
				return;
			}

			context.addInitializer(applyAllFieldInterceptors);
		};

	const derive = <TNewField = TField, TNewThis = TThis>(
		childOptions?: DeriveOptions<TMeta, TArgs>
	): DecoratedPropertyFactory<TMeta, TArgs, TNewField, TNewThis, TCard> =>
		buildFieldFactory<TMeta, TArgs, TNewField, TNewThis, TCard>(
			key,
			mergeExtendedOptions(options, childOptions),
			hookRefs as unknown as FieldHookRefs<TMeta, TNewField>
		);

	return Object.assign(decoratorFn, {
		key,
		...createMemberFactoryHelpers<TMeta, TCard>(key, "property", label),
		derive,
	}) as DecoratedPropertyFactory<TMeta, TArgs, TField, TThis, TCard>;
}

/**
 * List-cardinality variant of {@link createFieldInterceptor}: repeat
 * decorations append entries instead of throwing on duplicates.
 *
 * @throws {TypeError} When `onInit` is missing.
 */
export function createFieldListInterceptor<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TField = unknown,
	// biome-ignore lint/suspicious/noExplicitAny: default TThis for Stage 3 `this:` typing
	TThis = any,
>(
	options: FieldInterceptorOptions<TMeta, TArgs, TField>
): DecoratedPropertyFactory<TMeta, TArgs, TField, TThis, "list"> {
	requireFieldHook(options, "intercept.field.list");

	const key = mintMetadataKey<TMeta>("list", options.name);
	const { onInit, ...rest } = options;
	return buildFieldFactory<TMeta, TArgs, TField, TThis, "list">(key, rest as DecoratorOptions<TMeta, TArgs>, {
		onInit,
	});
}

function requireFieldHook(options: { onInit?: unknown }, label: string): void {
	if (typeof options.onInit !== "function") {
		throw new TypeError(`${label}: onInit hook is required`);
	}
}

function registerFieldInterceptor<TMeta, TField>(key: MetadataKey<TMeta>, refs: FieldHookRefs<TMeta, TField>): void {
	fieldInterceptors.set(key, refs as FieldHookRefs<unknown, unknown>);
}

/**
 * Instance-side addInitializer body shared across every `intercept.field`
 * decoration. References only `this.constructor` and module-global state, so
 * Bun 1.3's `var _init` closure-sharing produces correct results regardless of
 * which class's addInit binding survives shadowing.
 */
function applyAllFieldInterceptors(this: unknown): void {
	const ctor = (this as { constructor: Ctor }).constructor;
	const target = this as Record<string | symbol, unknown>;

	walkPrototypeChain(ctor, (link) => {
		prepare(link);
	});

	// Re-apply on every fire: under correct emit, each addInit slot may run
	// before a later subclass field initializer has executed (which would
	// overwrite an earlier replacement). Calling onInit again with the latest
	// value reproduces the final per-field state. The hook is expected to be
	// idempotent in (current value, metadata).
	for (const [key, refs] of fieldInterceptors) {
		for (const name of collectMemberNames(ctor, key)) {
			if (getMemberStatic(ctor, key, name)) {
				continue;
			}
			const reader = makeInstanceReader(key, name);
			const interceptorContext: InterceptorContext = { name, static: false, kind: "field" };
			target[name] = refs.onInit.call(target, target[name], reader, interceptorContext);
		}
	}
}

function makeInstanceReader<TMeta>(key: MetadataKey<TMeta>, name: string | symbol): (instance: object) => TMeta[] {
	return (instance: object) => collectMemberMeta<TMeta>((instance as { constructor: Ctor }).constructor, key, name);
}

function makeStaticReader<TMeta>(key: MetadataKey<TMeta>, name: string | symbol): (instance: object) => TMeta[] {
	return (instance: object) => collectMemberMeta<TMeta>(instance as unknown as Ctor, key, name);
}
