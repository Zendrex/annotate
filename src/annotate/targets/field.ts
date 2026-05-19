/** biome-ignore-all lint/suspicious/noExplicitAny: field decorator initializer return types must remain assignable to literal field initializers */
import { prepare } from "../../metadata/pipeline";
import { collectMemberNames, getMemberStatic } from "../../metadata/store";
import { walkPrototypeChain } from "../../runtime/prototype-chain";
import { emitMemberDecoration } from "../decorations";
import { createMemberMetadataReader, mapArgs, prepareTargetBuilder } from "./shared";
import type { Cardinality, Ctor, MemberKind, MetadataKey } from "../../metadata/types";
import type { FieldHookRefs, InternalAnnotationOptions, InternalInterceptorContext } from "../internal-types";

const fieldInterceptors = new Map<MetadataKey, FieldHookRefs<unknown, unknown>>();
const initializedFields = new WeakMap<object, Set<string | symbol>>();

interface IndexedFieldEntry {
	context: InternalInterceptorContext;
	init: FieldHookRefs<unknown, unknown>["init"];
	name: string | symbol;
	reader: (instance: object) => unknown[];
}

const ctorFieldIndex = new WeakMap<Ctor, readonly IndexedFieldEntry[]>();

function registerFieldInterceptor<TMeta, TField>(
	key: MetadataKey<TMeta>,
	hookRefs: FieldHookRefs<TMeta, TField>
): void {
	fieldInterceptors.set(key, hookRefs as FieldHookRefs<unknown, unknown>);
}

function markFieldInitialized(target: object, name: string | symbol): void {
	let names = initializedFields.get(target);
	if (!names) {
		names = new Set();
		initializedFields.set(target, names);
	}
	names.add(name);
}

function isFieldInitialized(target: object, name: string | symbol): boolean {
	return initializedFields.get(target)?.has(name) ?? false;
}

function buildFieldEntries(ctor: Ctor): IndexedFieldEntry[] {
	const entries: IndexedFieldEntry[] = [];
	for (const [key, refs] of fieldInterceptors) {
		for (const name of collectMemberNames(ctor, key)) {
			if (getMemberStatic(ctor, key, name)) {
				continue;
			}
			entries.push({
				context: { name, static: false, kind: "field" },
				init: refs.init,
				name,
				reader: createMemberMetadataReader<unknown>(key, name, false),
			});
		}
	}
	return entries;
}

function applyAllFieldInterceptors(this: unknown): void {
	const ctor = (this as { constructor: Ctor }).constructor;
	const target = this as Record<string | symbol, unknown>;

	walkPrototypeChain(ctor, (link) => {
		prepare(link);
	});

	let entries = ctorFieldIndex.get(ctor);
	if (!entries) {
		entries = buildFieldEntries(ctor);
		ctorFieldIndex.set(ctor, entries);
	}

	for (const entry of entries) {
		if (isFieldInitialized(target, entry.name)) {
			continue;
		}
		target[entry.name] = entry.init.call(target, target[entry.name], entry.reader, entry.context);
		markFieldInitialized(target, entry.name);
	}
}

export function applyFieldInterceptors(instance: object): void {
	applyAllFieldInterceptors.call(instance);
}

export type FieldTargetDecorator<_TMeta, TArgs extends unknown[], TField, TThis> = (
	...args: TArgs
) => (
	value: undefined,
	context: ClassFieldDecoratorContext<TThis, TField>
) => ((this: TThis, initial: any) => any) | undefined;

export function buildFieldTarget<TMeta, TArgs extends unknown[], TField, TThis, TCard extends Cardinality = "unique">(
	key: MetadataKey<TMeta, TCard>,
	options: InternalAnnotationOptions<TMeta, TArgs> | undefined,
	storedKind: Extract<MemberKind, "property" | "field"> = "field"
): FieldTargetDecorator<TMeta, TArgs, TField, TThis> {
	const { argsMapper, validators } = prepareTargetBuilder<TMeta, TArgs>(key, options);

	return (...args: TArgs) =>
		(_value: undefined, context: ClassFieldDecoratorContext<TThis, TField>): undefined => {
			emitMemberDecoration({
				context,
				key,
				kind: storedKind,
				meta: mapArgs(args, argsMapper),
				token: Symbol("fieldDecoration"),
				validators,
			});
			return;
		};
}

export function buildFieldInterceptorTarget<
	TMeta,
	TArgs extends unknown[],
	TField,
	TThis,
	TCard extends Cardinality = "unique",
>(
	key: MetadataKey<TMeta, TCard>,
	options: InternalAnnotationOptions<TMeta, TArgs> | undefined,
	hookRefs: FieldHookRefs<TMeta, TField>,
	storedKind: Extract<MemberKind, "property" | "field"> = "field"
): FieldTargetDecorator<TMeta, TArgs, TField, TThis> {
	const { argsMapper, validators } = prepareTargetBuilder<TMeta, TArgs>(key, options);
	const { init } = hookRefs;

	registerFieldInterceptor(key, hookRefs);

	return (...args: TArgs) =>
		(
			_value: undefined,
			context: ClassFieldDecoratorContext<TThis, TField>
		): ((this: TThis, initial: any) => any) | undefined => {
			emitMemberDecoration({
				context,
				key,
				kind: storedKind,
				meta: mapArgs(args, argsMapper),
				token: Symbol("fieldIntercept"),
				validators,
			});

			if (context.static) {
				const memberName = context.name;
				const readMetadata = createMemberMetadataReader<TMeta>(key, memberName, true);
				const interceptorContext: InternalInterceptorContext = {
					name: memberName,
					static: true,
					kind: "field",
				};
				context.addInitializer(function (this: unknown) {
					const ctor = this as Ctor;
					const target = ctor as unknown as Record<string | symbol, TField>;
					target[memberName] = init.call(
						target,
						target[memberName] as TField,
						readMetadata,
						interceptorContext
					);
				});
				return;
			}

			const memberName = context.name;
			const readMetadata = createMemberMetadataReader<TMeta>(key, memberName, false);
			const interceptorContext: InternalInterceptorContext = { name: memberName, static: false, kind: "field" };
			return function (this: TThis, initial: TField): TField {
				walkPrototypeChain((this as { constructor: Ctor }).constructor, (link) => {
					prepare(link);
				});
				const next = init.call(this, initial, readMetadata, interceptorContext);
				markFieldInitialized(this as object, memberName);
				return next;
			};
		};
}
