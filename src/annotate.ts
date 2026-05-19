/** biome-ignore-all lint/suspicious/noExplicitAny: public decorator handles default to permissive target types unless callers constrain them */
import { InvalidSelectorError } from "./errors";
import { buildAccessorFactory } from "./factories/accessor-interceptor";
import { buildClassFactory } from "./factories/class-decorator";
import { buildFieldFactory } from "./factories/field-interceptor";
import { buildMethodFactory } from "./factories/method-decorator";
import { buildPropertyFactory } from "./factories/property-decorator";
import { mintMetadataKey } from "./metadata/cardinality-registry";
import { collectClassMeta } from "./metadata/class-meta-store";
import { collectMemberMeta, snapshotMembers } from "./metadata/member-meta-store";
import { targetDisplayName } from "./reflector/class-name";
import { resolveReflectTarget } from "./reflector/resolve-instance";
import { prepare } from "./runtime/prepare";
import type { AccessorHookRefs } from "./factories/accessor-interceptor";
import type { FieldHookRefs } from "./factories/field-interceptor";
import type { MethodHookRefs } from "./factories/method-decorator";
import type { AnyFn, DecoratorOptions } from "./factories/types";
import type { ValidatorFn } from "./factories/validator-types";
import type { MemberKind, MetadataKey } from "./metadata/types";
import type { AnyConstructor } from "./reflector/types";

export type Cardinality = "one" | "many";

type InternalCardinalityOf<TCard extends Cardinality> = TCard extends "many" ? "list" : "unique";
type ReadResult<TMeta, TCard extends Cardinality> = TCard extends "many" ? readonly TMeta[] : TMeta | undefined;

export interface AnnotationOptions<TMeta, TCard extends Cardinality = "one"> {
	cardinality?: TCard;
	label?: string;
	requires?: AnyConstructor;
	validate?: ValidatorFn<TMeta>;
}

export interface AnnotationArgsOptions<TMeta, TArgs extends unknown[], TCard extends Cardinality = "one">
	extends AnnotationOptions<TMeta, TCard> {
	args: (...args: TArgs) => TMeta;
}

interface LegacyOptionsInput<TMeta, TArgs extends unknown[], TCard extends Cardinality>
	extends AnnotationOptions<TMeta, TCard> {
	args?: (...args: TArgs) => TMeta;
}

export interface ClassAnnotationEntry<TMeta, TCard extends Cardinality = Cardinality> {
	kind: "class";
	metadata: TCard extends "many" ? readonly TMeta[] : TMeta;
	name: string;
	target: AnyConstructor;
}

export interface MemberAnnotationEntry<TMeta, TCard extends Cardinality = Cardinality> {
	kind: "method" | "field" | "accessor";
	metadata: TCard extends "many" ? readonly TMeta[] : TMeta;
	name: string | symbol;
	static: boolean;
}

export interface ClassAnnotationReader<TMeta, TCard extends Cardinality> {
	entries(): ClassAnnotationEntry<TMeta, TCard>[];
	get(): ReadResult<TMeta, TCard>;
}

export interface StaticMemberAnnotationReader<TMeta, TCard extends Cardinality, TStatic> {
	get(selector: (target: TStatic) => unknown): ReadResult<TMeta, TCard>;
}

export interface MemberAnnotationReader<TMeta, TCard extends Cardinality, TThis, TStatic = unknown> {
	accessors(): MemberAnnotationEntry<TMeta, TCard>[];
	entries(): MemberAnnotationEntry<TMeta, TCard>[];
	fields(): MemberAnnotationEntry<TMeta, TCard>[];
	get(selector: (target: TThis) => unknown): ReadResult<TMeta, TCard>;
	methods(): MemberAnnotationEntry<TMeta, TCard>[];
	readonly static: StaticMemberAnnotationReader<TMeta, TCard, TStatic>;
}

export interface PublicInterceptorContext<TMeta, TCard extends Cardinality> {
	get(instance: object): ReadResult<TMeta, TCard>;
	kind: "method" | "field" | "accessor";
	name: string | symbol;
	static: boolean;
}

export type ClassAnnotation<TMeta, TArgs extends unknown[], TInstance, TCard extends Cardinality> = ((
	...args: TArgs
) => <T extends abstract new (...args: never[]) => TInstance>(value: T, context: ClassDecoratorContext<T>) => void) & {
	read(target: object): ClassAnnotationReader<TMeta, TCard>;
};

export type MethodAnnotation<
	TMeta,
	TArgs extends unknown[],
	TMethod extends AnyFn,
	TThis,
	TCard extends Cardinality,
> = ((
	...args: TArgs
) => (value: TMethod, context: ClassMethodDecoratorContext<TThis, TMethod>) => TMethod | undefined) & {
	read<TTarget extends object>(target: TTarget): MemberAnnotationReader<TMeta, TCard, TThis, TTarget>;
};

export type FieldAnnotation<TMeta, TArgs extends unknown[], TField, TThis, TCard extends Cardinality> = ((
	...args: TArgs
) => (value: undefined, context: ClassFieldDecoratorContext<TThis, TField>) => void) & {
	read<TTarget extends object>(target: TTarget): MemberAnnotationReader<TMeta, TCard, TThis, TTarget>;
};

export type AccessorAnnotation<TMeta, TArgs extends unknown[], TValue, TThis, TCard extends Cardinality> = ((
	...args: TArgs
) => (
	value: ClassAccessorDecoratorTarget<TThis, TValue>,
	context: ClassAccessorDecoratorContext<TThis, TValue>
) => ClassAccessorDecoratorResult<TThis, TValue> | undefined) & {
	read<TTarget extends object>(target: TTarget): MemberAnnotationReader<TMeta, TCard, TThis, TTarget>;
};

export type MethodInterceptorOptions<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TMethod extends AnyFn = AnyFn,
	TCard extends Cardinality = "one",
> = LegacyOptionsInput<TMeta, TArgs, TCard> & {
	wrap: (original: TMethod, context: PublicInterceptorContext<TMeta, TCard>) => TMethod;
};

export type AccessorInterceptorOptions<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TValue = unknown,
	TCard extends Cardinality = "one",
> = LegacyOptionsInput<TMeta, TArgs, TCard> & {
	get?: (original: () => TValue, context: PublicInterceptorContext<TMeta, TCard>) => () => TValue;
	set?: (
		original: (value: TValue) => void,
		context: PublicInterceptorContext<TMeta, TCard>
	) => (value: TValue) => void;
};

export type FieldInterceptorOptions<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TField = unknown,
	TCard extends Cardinality = "one",
> = LegacyOptionsInput<TMeta, TArgs, TCard> & {
	init: (initial: TField, context: PublicInterceptorContext<TMeta, TCard>) => TField;
};

type BuilderInput<TMeta, TArgs extends unknown[], TCard extends Cardinality> =
	| ((...args: TArgs) => TMeta)
	| LegacyOptionsInput<TMeta, TArgs, TCard>
	| undefined;

function resolveCardinality<TMeta, TArgs extends unknown[], TCard extends Cardinality>(
	input: BuilderInput<TMeta, TArgs, TCard>
): TCard {
	return (typeof input === "object" && input?.cardinality ? input.cardinality : "one") as TCard;
}

function toLegacyOptions<TMeta, TArgs extends unknown[], TCard extends Cardinality>(
	input: BuilderInput<TMeta, TArgs, TCard>
): DecoratorOptions<TMeta, TArgs> | undefined {
	if (typeof input === "function") {
		return { compose: input } as DecoratorOptions<TMeta, TArgs>;
	}
	if (!input) {
		return;
	}
	const options: {
		compose?: (...args: TArgs) => TMeta;
		name?: string;
		requireInstanceOf?: AnyConstructor;
		validate?: ValidatorFn<TMeta>;
	} = {};
	if (input.args) {
		options.compose = input.args;
	}
	if (input.label !== undefined) {
		options.name = input.label;
	}
	if (input.requires) {
		options.requireInstanceOf = input.requires;
	}
	if (input.validate) {
		options.validate = input.validate;
	}
	return options as DecoratorOptions<TMeta, TArgs>;
}

function mintKey<TMeta, TCard extends Cardinality>(
	cardinality: TCard,
	label?: string
): MetadataKey<TMeta, InternalCardinalityOf<TCard>> {
	return (
		cardinality === "many" ? mintMetadataKey<TMeta>("list", label) : mintMetadataKey<TMeta>("unique", label)
	) as MetadataKey<TMeta, InternalCardinalityOf<TCard>>;
}

function formatRead<TMeta, TCard extends Cardinality>(
	values: readonly TMeta[],
	cardinality: TCard
): ReadResult<TMeta, TCard> {
	if (cardinality === "many") {
		return Object.freeze([...values]) as ReadResult<TMeta, TCard>;
	}
	return values[0] as ReadResult<TMeta, TCard>;
}

function formatMetadata<TMeta, TCard extends Cardinality>(
	values: readonly unknown[],
	cardinality: TCard
): TCard extends "many" ? readonly TMeta[] : TMeta {
	if (cardinality === "many") {
		return Object.freeze([...values]) as TCard extends "many" ? readonly TMeta[] : TMeta;
	}
	return values[0] as TCard extends "many" ? readonly TMeta[] : TMeta;
}

function prepareTarget(target: object): AnyConstructor {
	const ctor = resolveReflectTarget(target);
	prepare(ctor);
	return ctor;
}

function resolveSelector(target: AnyConstructor, selector: (target: never) => unknown): string | symbol {
	const reads: (string | symbol)[] = [];
	let invoked = false;
	const selectedValue = new Proxy(() => undefined, {
		apply() {
			invoked = true;
			return;
		},
		get(_target, property) {
			reads.push(property);
			return selectedValue;
		},
	});
	const root = new Proxy(Object.create(null), {
		get(_target, property) {
			reads.push(property);
			return selectedValue;
		},
	});

	selector(root as never);

	if (invoked) {
		throw new InvalidSelectorError(target, "selectors must read a member, not invoke it");
	}
	if (reads.length !== 1) {
		throw new InvalidSelectorError(target, "selectors must read exactly one member");
	}
	return reads[0] as string | symbol;
}

function createClassReader<TMeta, TCard extends Cardinality>(
	key: MetadataKey<TMeta>,
	cardinality: TCard,
	target: object
): ClassAnnotationReader<TMeta, TCard> {
	const ctor = prepareTarget(target);
	return {
		entries: () => {
			const values = collectClassMeta<TMeta>(ctor, key);
			if (values.length === 0) {
				return [];
			}
			return [
				{
					kind: "class",
					metadata: formatMetadata<TMeta, TCard>(values, cardinality),
					name: targetDisplayName(ctor),
					target: ctor,
				},
			] as ClassAnnotationEntry<TMeta, TCard>[];
		},
		get: () => formatRead(collectClassMeta<TMeta>(ctor, key), cardinality),
	};
}

function createMemberReader<TMeta, TCard extends Cardinality, TThis>(
	key: MetadataKey<TMeta>,
	cardinality: TCard,
	target: object
): MemberAnnotationReader<TMeta, TCard, TThis, AnyConstructor> {
	const ctor = prepareTarget(target);

	const entriesFor = (kind?: Extract<MemberKind, "method" | "field" | "accessor">) => {
		const entries: MemberAnnotationEntry<TMeta, TCard>[] = [];
		for (const [name, entry] of snapshotMembers(ctor, key)) {
			if (entry.values.length === 0 || (kind && entry.kind !== kind)) {
				continue;
			}
			if (entry.kind !== "method" && entry.kind !== "field" && entry.kind !== "accessor") {
				continue;
			}
			entries.push({
				kind: entry.kind,
				metadata: formatMetadata<TMeta, TCard>(entry.values, cardinality),
				name,
				static: entry.static,
			});
		}
		return entries;
	};

	return {
		static: {
			get: (selector) => {
				const name = resolveSelector(ctor, selector as (target: never) => unknown);
				return formatRead(collectMemberMeta<TMeta>(ctor, key, name), cardinality);
			},
		},
		accessors: () => entriesFor("accessor"),
		entries: () => entriesFor(),
		fields: () => entriesFor("field"),
		get: (selector) => {
			const name = resolveSelector(ctor, selector as (target: never) => unknown);
			return formatRead(collectMemberMeta<TMeta>(ctor, key, name), cardinality);
		},
		methods: () => entriesFor("method"),
	};
}

function attachClassRead<TFactory extends object, TMeta, TCard extends Cardinality>(
	factory: TFactory,
	key: MetadataKey<TMeta>,
	cardinality: TCard
): TFactory & { read(target: object): ClassAnnotationReader<TMeta, TCard> } {
	return Object.assign(factory, {
		read: (target: object) => createClassReader<TMeta, TCard>(key, cardinality, target),
	});
}

function attachMemberRead<TFactory extends object, TMeta, TCard extends Cardinality, TThis>(
	factory: TFactory,
	key: MetadataKey<TMeta>,
	cardinality: TCard
): TFactory & { read(target: object): MemberAnnotationReader<TMeta, TCard, TThis, AnyConstructor> } {
	return Object.assign(factory, {
		read: (target: object) => createMemberReader<TMeta, TCard, TThis>(key, cardinality, target),
	});
}

function publicContext<TMeta, TCard extends Cardinality>(
	base: { kind: "method" | "field" | "accessor"; name: string | symbol; static: boolean },
	readMetadata: (instance: object) => TMeta[],
	cardinality: TCard
): PublicInterceptorContext<TMeta, TCard> {
	return {
		...base,
		get: (instance) => formatRead(readMetadata(instance), cardinality),
	};
}

function classAnnotation<TMeta, TArgs extends unknown[], TInstance, TCard extends Cardinality>(
	input?: BuilderInput<TMeta, TArgs, TCard>
): ClassAnnotation<TMeta, TArgs, TInstance, TCard> {
	const cardinality = resolveCardinality(input);
	const options = toLegacyOptions(input);
	const key = mintKey<TMeta, TCard>(cardinality, options?.name);
	const factory = buildClassFactory<TMeta, TArgs, TInstance, InternalCardinalityOf<TCard>>(key, options);
	return attachClassRead(factory, key, cardinality) as ClassAnnotation<TMeta, TArgs, TInstance, TCard>;
}

function methodAnnotation<TMeta, TArgs extends unknown[], TMethod extends AnyFn, TThis, TCard extends Cardinality>(
	input?: BuilderInput<TMeta, TArgs, TCard>
): MethodAnnotation<TMeta, TArgs, TMethod, TThis, TCard> {
	const cardinality = resolveCardinality(input);
	const options = toLegacyOptions(input);
	const key = mintKey<TMeta, TCard>(cardinality, options?.name);
	const factory = buildMethodFactory<TMeta, TArgs, TMethod, TThis, InternalCardinalityOf<TCard>>(key, options);
	return attachMemberRead<typeof factory, TMeta, TCard, TThis>(factory, key, cardinality) as MethodAnnotation<
		TMeta,
		TArgs,
		TMethod,
		TThis,
		TCard
	>;
}

function fieldAnnotation<TMeta, TArgs extends unknown[], TField, TThis, TCard extends Cardinality>(
	input?: BuilderInput<TMeta, TArgs, TCard>
): FieldAnnotation<TMeta, TArgs, TField, TThis, TCard> {
	const cardinality = resolveCardinality(input);
	const options = toLegacyOptions(input);
	const key = mintKey<TMeta, TCard>(cardinality, options?.name);
	const factory = buildPropertyFactory<TMeta, TArgs, TField, TThis, InternalCardinalityOf<TCard>>(
		key,
		options,
		"field"
	);
	return attachMemberRead<typeof factory, TMeta, TCard, TThis>(factory, key, cardinality) as FieldAnnotation<
		TMeta,
		TArgs,
		TField,
		TThis,
		TCard
	>;
}

function accessorAnnotation<TMeta, TArgs extends unknown[], TValue, TThis, TCard extends Cardinality>(
	input?: BuilderInput<TMeta, TArgs, TCard>
): AccessorAnnotation<TMeta, TArgs, TValue, TThis, TCard> {
	const cardinality = resolveCardinality(input);
	const options = toLegacyOptions(input);
	const key = mintKey<TMeta, TCard>(cardinality, options?.name);
	const factory = buildAccessorFactory<TMeta, TArgs, TValue, TThis, InternalCardinalityOf<TCard>>(
		key,
		options,
		{},
		"accessor"
	);
	return attachMemberRead<typeof factory, TMeta, TCard, TThis>(factory, key, cardinality) as AccessorAnnotation<
		TMeta,
		TArgs,
		TValue,
		TThis,
		TCard
	>;
}

function methodInterceptor<TMeta, TArgs extends unknown[], TMethod extends AnyFn, TThis, TCard extends Cardinality>(
	options: MethodInterceptorOptions<TMeta, TArgs, TMethod, TCard>
): MethodAnnotation<TMeta, TArgs, TMethod, TThis, TCard> {
	const cardinality = resolveCardinality(options);
	const legacyOptions = toLegacyOptions(options);
	const key = mintKey<TMeta, TCard>(cardinality, legacyOptions?.name);
	const hookRefs: MethodHookRefs<TMeta, TMethod> = {
		intercept: (original, readMetadata, context) =>
			options.wrap(
				original,
				publicContext({ kind: "method", name: context.name, static: context.static }, readMetadata, cardinality)
			),
	};
	const factory = buildMethodFactory<TMeta, TArgs, TMethod, TThis, InternalCardinalityOf<TCard>>(
		key,
		legacyOptions,
		hookRefs
	);
	return attachMemberRead<typeof factory, TMeta, TCard, TThis>(factory, key, cardinality) as MethodAnnotation<
		TMeta,
		TArgs,
		TMethod,
		TThis,
		TCard
	>;
}

function accessorInterceptor<TMeta, TArgs extends unknown[], TValue, TThis, TCard extends Cardinality>(
	options: AccessorInterceptorOptions<TMeta, TArgs, TValue, TCard>
): AccessorAnnotation<TMeta, TArgs, TValue, TThis, TCard> {
	const cardinality = resolveCardinality(options);
	const legacyOptions = toLegacyOptions(options);
	const key = mintKey<TMeta, TCard>(cardinality, legacyOptions?.name);
	const hookRefs: AccessorHookRefs<TMeta, TValue> = {};
	if (options.get) {
		hookRefs.onGet = (original, readMetadata, context) =>
			options.get?.(
				original,
				publicContext(
					{ kind: "accessor", name: context.name, static: context.static },
					readMetadata,
					cardinality
				)
			) ?? original;
	}
	if (options.set) {
		hookRefs.onSet = (original, readMetadata, context) =>
			options.set?.(
				original,
				publicContext(
					{ kind: "accessor", name: context.name, static: context.static },
					readMetadata,
					cardinality
				)
			) ?? original;
	}
	const factory = buildAccessorFactory<TMeta, TArgs, TValue, TThis, InternalCardinalityOf<TCard>>(
		key,
		legacyOptions,
		hookRefs,
		"accessor"
	);
	return attachMemberRead<typeof factory, TMeta, TCard, TThis>(factory, key, cardinality) as AccessorAnnotation<
		TMeta,
		TArgs,
		TValue,
		TThis,
		TCard
	>;
}

function fieldInterceptor<TMeta, TArgs extends unknown[], TField, TThis, TCard extends Cardinality>(
	options: FieldInterceptorOptions<TMeta, TArgs, TField, TCard>
): FieldAnnotation<TMeta, TArgs, TField, TThis, TCard> {
	const cardinality = resolveCardinality(options);
	const legacyOptions = toLegacyOptions(options);
	const key = mintKey<TMeta, TCard>(cardinality, legacyOptions?.name);
	const hookRefs: FieldHookRefs<TMeta, TField> = {
		onInit: (initial, readMetadata, context) =>
			options.init(
				initial,
				publicContext({ kind: "field", name: context.name, static: context.static }, readMetadata, cardinality)
			),
	};
	const factory = buildFieldFactory<TMeta, TArgs, TField, TThis, InternalCardinalityOf<TCard>>(
		key,
		legacyOptions,
		hookRefs,
		"field"
	);
	return attachMemberRead<typeof factory, TMeta, TCard, TThis>(factory, key, cardinality) as FieldAnnotation<
		TMeta,
		TArgs,
		TField,
		TThis,
		TCard
	>;
}

interface AnnotateNamespace {
	accessor<TMeta>(options?: AnnotationOptions<TMeta, "one">): AccessorAnnotation<TMeta, [TMeta], any, any, "one">;
	accessor<TMeta>(options: AnnotationOptions<TMeta, "many">): AccessorAnnotation<TMeta, [TMeta], any, any, "many">;
	accessor<TArgs extends unknown[], TMeta>(
		args: (...args: TArgs) => TMeta
	): AccessorAnnotation<TMeta, TArgs, any, any, "one">;
	accessor<TMeta, TArgs extends unknown[], TCard extends Cardinality = "one">(
		options: AnnotationArgsOptions<TMeta, TArgs, TCard>
	): AccessorAnnotation<TMeta, TArgs, any, any, TCard>;

	class<TMeta>(options?: AnnotationOptions<TMeta, "one">): ClassAnnotation<TMeta, [TMeta], unknown, "one">;
	class<TMeta>(options: AnnotationOptions<TMeta, "many">): ClassAnnotation<TMeta, [TMeta], unknown, "many">;
	class<TArgs extends unknown[], TMeta>(
		args: (...args: TArgs) => TMeta
	): ClassAnnotation<TMeta, TArgs, unknown, "one">;
	class<TMeta, TArgs extends unknown[], TCard extends Cardinality = "one">(
		options: AnnotationArgsOptions<TMeta, TArgs, TCard>
	): ClassAnnotation<TMeta, TArgs, unknown, TCard>;

	field<TMeta>(options?: AnnotationOptions<TMeta, "one">): FieldAnnotation<TMeta, [TMeta], any, any, "one">;
	field<TMeta>(options: AnnotationOptions<TMeta, "many">): FieldAnnotation<TMeta, [TMeta], any, any, "many">;
	field<TArgs extends unknown[], TMeta>(
		args: (...args: TArgs) => TMeta
	): FieldAnnotation<TMeta, TArgs, any, any, "one">;
	field<TMeta, TArgs extends unknown[], TCard extends Cardinality = "one">(
		options: AnnotationArgsOptions<TMeta, TArgs, TCard>
	): FieldAnnotation<TMeta, TArgs, any, any, TCard>;

	intercept: {
		accessor<TMeta, TValue = any>(
			options: AccessorInterceptorOptions<TMeta, [TMeta], TValue, "one">
		): AccessorAnnotation<TMeta, [TMeta], TValue, any, "one">;
		accessor<TMeta, TValue = any>(
			options: AccessorInterceptorOptions<TMeta, [TMeta], TValue, "many">
		): AccessorAnnotation<TMeta, [TMeta], TValue, any, "many">;
		accessor<
			TMeta,
			TArgs extends unknown[] = [TMeta],
			TValue = any,
			TThis = any,
			TCard extends Cardinality = "one",
		>(
			options: AccessorInterceptorOptions<TMeta, TArgs, TValue, TCard>
		): AccessorAnnotation<TMeta, TArgs, TValue, TThis, TCard>;
		field<TMeta, TField = any>(
			options: FieldInterceptorOptions<TMeta, [TMeta], TField, "one">
		): FieldAnnotation<TMeta, [TMeta], TField, any, "one">;
		field<TMeta, TField = any>(
			options: FieldInterceptorOptions<TMeta, [TMeta], TField, "many">
		): FieldAnnotation<TMeta, [TMeta], TField, any, "many">;
		field<TMeta, TArgs extends unknown[] = [TMeta], TField = any, TThis = any, TCard extends Cardinality = "one">(
			options: FieldInterceptorOptions<TMeta, TArgs, TField, TCard>
		): FieldAnnotation<TMeta, TArgs, TField, TThis, TCard>;
		method<TMeta, TMethod extends AnyFn = AnyFn>(
			options: MethodInterceptorOptions<TMeta, [TMeta], TMethod, "one">
		): MethodAnnotation<TMeta, [TMeta], TMethod, any, "one">;
		method<TMeta, TMethod extends AnyFn = AnyFn>(
			options: MethodInterceptorOptions<TMeta, [TMeta], TMethod, "many">
		): MethodAnnotation<TMeta, [TMeta], TMethod, any, "many">;
		method<
			TMeta,
			TArgs extends unknown[] = [TMeta],
			TMethod extends AnyFn = AnyFn,
			TThis = any,
			TCard extends Cardinality = "one",
		>(
			options: MethodInterceptorOptions<TMeta, TArgs, TMethod, TCard>
		): MethodAnnotation<TMeta, TArgs, TMethod, TThis, TCard>;
	};

	method<TMeta>(options?: AnnotationOptions<TMeta, "one">): MethodAnnotation<TMeta, [TMeta], AnyFn, any, "one">;
	method<TMeta>(options: AnnotationOptions<TMeta, "many">): MethodAnnotation<TMeta, [TMeta], AnyFn, any, "many">;
	method<TArgs extends unknown[], TMeta>(
		args: (...args: TArgs) => TMeta
	): MethodAnnotation<TMeta, TArgs, AnyFn, any, "one">;
	method<TMeta, TArgs extends unknown[], TCard extends Cardinality = "one">(
		options: AnnotationArgsOptions<TMeta, TArgs, TCard>
	): MethodAnnotation<TMeta, TArgs, AnyFn, any, TCard>;
}

export const Annotate: AnnotateNamespace = Object.freeze({
	accessor: accessorAnnotation,
	class: classAnnotation,
	field: fieldAnnotation,
	intercept: Object.freeze({
		accessor: accessorInterceptor,
		field: fieldInterceptor,
		method: methodInterceptor,
	}),
	method: methodAnnotation,
} as AnnotateNamespace);

export type { ValidateContext } from "./factories/validator-types";
