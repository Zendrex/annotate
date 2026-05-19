import { mintMetadataKey } from "../metadata/cardinality";
import { collectMemberNames, getMemberStatic } from "../metadata/stores/member-meta-store";
import { prepare } from "../runtime/prepare";
import {
	compose,
	createMemberFactoryHelpers,
	createMemberMetadataReader,
	emitMemberDecoration,
	mergeExtendedOptions,
	prepareFactoryShell,
} from "./shared";
import type { Cardinality, Ctor, MemberKind, MetadataKey } from "../metadata/types";
import type {
	DecoratedPropertyFactory,
	DecoratorOptions,
	DeriveOptions,
	FieldInterceptorOptions,
	InterceptorContext,
} from "./types";

export interface FieldHookRefs<TMeta, TField> {
	onInit: (initial: TField, readMetadata: (instance: object) => TMeta[], context: InterceptorContext) => TField;
}

// Module-global registry of every `intercept.field` factory. The instance
// addInitializer body iterates this registry rather than capturing per-decoration
// state, so it survives Bun 1.3's module-shared `var _init` transformer bug where
// only the last-registered instance addInit fires.
const fieldInterceptors = new Map<MetadataKey, FieldHookRefs<unknown, unknown>>();

interface IndexedFieldEntry {
	context: InterceptorContext;
	name: string | symbol;
	onInit: FieldHookRefs<unknown, unknown>["onInit"];
	reader: (instance: object) => unknown[];
}

// Per-ctor cache of instance-field interceptor entries, built lazily on the first
// `applyAllFieldInterceptors` call. Decorations are frozen at class evaluation time.
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
 * Field replacement runs from `addInitializer` via a module-global registry, not
 * a decorator-returned initializer (Bun 1.3 shares one module-scope closure across classes).
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

export function buildFieldFactory<TMeta, TArgs extends unknown[], TField, TThis, TCard extends Cardinality = "unique">(
	key: MetadataKey<TMeta, TCard>,
	options: DecoratorOptions<TMeta, TArgs> | undefined,
	hookRefs: FieldHookRefs<TMeta, TField>,
	storedKind: Extract<MemberKind, "property" | "field"> = "property"
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
				kind: storedKind,
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
			hookRefs as unknown as FieldHookRefs<TMeta, TNewField>,
			storedKind
		);

	return Object.assign(decoratorFn, {
		key,
		...createMemberFactoryHelpers<TMeta, TCard>(key, "property", label),
		derive,
	}) as DecoratedPropertyFactory<TMeta, TArgs, TField, TThis, TCard>;
}

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

export function applyFieldInterceptors(instance: object): void {
	applyAllFieldInterceptors.call(instance);
}
