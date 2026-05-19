import { mintMetadataKey } from "../metadata/cardinality-registry";
import { collectMemberNames, getMemberStatic } from "../metadata/member-meta-store";
import { prepare } from "../runtime/prepare";
import {
	compose,
	createMemberFactoryHelpers,
	createMemberMetadataReader,
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

/** @internal Resolved per-ctor instance-field interceptor entry; readers, contexts, and hook refs pre-bound. */
interface IndexedFieldEntry {
	context: InterceptorContext;
	name: string | symbol;
	onInit: FieldHookRefs<unknown, unknown>["onInit"];
	reader: (instance: object) => unknown[];
}

/**
 * Per-ctor cache of instance-field interceptor entries, built lazily on the
 * first `applyAllFieldInterceptors` call for that ctor. Field decorations are
 * frozen at class evaluation time, so the index never goes stale for a given
 * ctor; subsequent instances collapse to a single WeakMap lookup + tight loop.
 *
 * @internal
 */
const ctorFieldIndex = new WeakMap<Ctor, readonly IndexedFieldEntry[]>();

function buildFieldEntries(ctor: Ctor): IndexedFieldEntry[] {
	const entries: IndexedFieldEntry[] = [];
	for (const [key, refs] of fieldInterceptors) {
		for (const name of collectMemberNames(ctor, key)) {
			if (getMemberStatic(ctor, key, name)) {
				continue;
			}
			entries.push({
				context: { name, static: false, kind: "field" },
				name,
				onInit: refs.onInit,
				reader: createMemberMetadataReader<unknown>(key, name, false),
			});
		}
	}
	return entries;
}

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

	fieldInterceptors.set(key, hookRefs as FieldHookRefs<unknown, unknown>);

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
				const readMetadata = createMemberMetadataReader<TMeta>(key, memberName, true);
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

/**
 * Shared instance-side `addInitializer` body. Resolves work via
 * `this.constructor` and the module-global registry so Bun 1.3's shared
 * `var _init` closure produces correct results no matter which class's
 * addInit binding survives. `onInit` must be idempotent in
 * `(current value, metadata)` — it may fire repeatedly across the chain.
 */
function applyAllFieldInterceptors(this: unknown): void {
	const ctor = (this as { constructor: Ctor }).constructor;
	const target = this as Record<string | symbol, unknown>;

	// Inline chain walk: `prepare` short-circuits per-link via `isFullyPrepared`,
	// so the per-call cost collapses to one WeakSet probe per ancestor once
	// drained. A ctor-level cache would be unsound — a sibling subclass
	// queueing deferreds on a shared ancestor invalidates that ancestor's mark
	// without invalidating ours.
	let link: Ctor | null = ctor;
	while (link && link !== Function.prototype) {
		prepare(link);
		link = Object.getPrototypeOf(link) as Ctor | null;
	}

	let entries = ctorFieldIndex.get(ctor);
	if (!entries) {
		entries = buildFieldEntries(ctor);
		ctorFieldIndex.set(ctor, entries);
	}

	for (const entry of entries) {
		target[entry.name] = entry.onInit.call(target, target[entry.name], entry.reader, entry.context);
	}
}

/**
 * Re-applies every registered `intercept.field` interceptor's `onInit` to
 * `instance`. Idempotent post-construction recovery; see
 * {@link createFieldInterceptor} for the Bun 1.3 rationale.
 */
export function applyFieldInterceptors(instance: object): void {
	applyAllFieldInterceptors.call(instance);
}
