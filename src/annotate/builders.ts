import { normalizeBuilderInput } from "./normalize-input";
import { attachClassRead, attachMemberRead, publicContext } from "./readers";
import { buildAccessorTarget } from "./targets/accessor";
import { buildClassTarget } from "./targets/class";
import { buildFieldInterceptorTarget, buildFieldTarget } from "./targets/field";
import { buildMethodTarget } from "./targets/method";
import type { AccessorHookRefs, AnyFn, FieldHookRefs, InternalCardinalityOf, MethodHookRefs } from "./internal-types";
import type { BuilderInput } from "./normalize-input";
import type {
	AccessorAnnotation,
	AccessorInterceptorOptions,
	Cardinality,
	ClassAnnotation,
	FieldAnnotation,
	FieldInterceptorOptions,
	MethodAnnotation,
	MethodInterceptorOptions,
} from "./types";

export function classAnnotation<TMeta, TArgs extends unknown[], TInstance, TCard extends Cardinality>(
	input?: BuilderInput<TMeta, TArgs, TCard>
): ClassAnnotation<TMeta, TArgs, TInstance, TCard> {
	const { cardinality, key, options } = normalizeBuilderInput<TMeta, TArgs, TCard>(input);
	const factory = buildClassTarget<TMeta, TArgs, TInstance, InternalCardinalityOf<TCard>>(key, options);
	return attachClassRead(factory, key, cardinality) as ClassAnnotation<TMeta, TArgs, TInstance, TCard>;
}

export function methodAnnotation<
	TMeta,
	TArgs extends unknown[],
	TMethod extends AnyFn,
	TThis,
	TCard extends Cardinality,
>(input?: BuilderInput<TMeta, TArgs, TCard>): MethodAnnotation<TMeta, TArgs, TMethod, TThis, TCard> {
	const { cardinality, key, options } = normalizeBuilderInput<TMeta, TArgs, TCard>(input);
	const factory = buildMethodTarget<TMeta, TArgs, TMethod, TThis, InternalCardinalityOf<TCard>>(key, options);
	return attachMemberRead<typeof factory, TMeta, TCard, TThis>(factory, key, cardinality) as MethodAnnotation<
		TMeta,
		TArgs,
		TMethod,
		TThis,
		TCard
	>;
}

export function fieldAnnotation<TMeta, TArgs extends unknown[], TField, TThis, TCard extends Cardinality>(
	input?: BuilderInput<TMeta, TArgs, TCard>
): FieldAnnotation<TMeta, TArgs, TField, TThis, TCard> {
	const { cardinality, key, options } = normalizeBuilderInput<TMeta, TArgs, TCard>(input);
	const factory = buildFieldTarget<TMeta, TArgs, TField, TThis, InternalCardinalityOf<TCard>>(key, options, "field");
	return attachMemberRead<typeof factory, TMeta, TCard, TThis>(factory, key, cardinality) as FieldAnnotation<
		TMeta,
		TArgs,
		TField,
		TThis,
		TCard
	>;
}

export function accessorAnnotation<TMeta, TArgs extends unknown[], TValue, TThis, TCard extends Cardinality>(
	input?: BuilderInput<TMeta, TArgs, TCard>
): AccessorAnnotation<TMeta, TArgs, TValue, TThis, TCard> {
	const { cardinality, key, options } = normalizeBuilderInput<TMeta, TArgs, TCard>(input);
	const factory = buildAccessorTarget<TMeta, TArgs, TValue, TThis, InternalCardinalityOf<TCard>>(
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

export function methodInterceptor<
	TMeta,
	TArgs extends unknown[],
	TMethod extends AnyFn,
	TThis,
	TCard extends Cardinality,
>(
	options: MethodInterceptorOptions<TMeta, TArgs, TMethod, TCard>
): MethodAnnotation<TMeta, TArgs, TMethod, TThis, TCard> {
	const { cardinality, key, options: annotationOptions } = normalizeBuilderInput<TMeta, TArgs, TCard>(options);
	const hookRefs: MethodHookRefs<TMeta, TMethod> = {
		wrap: (original, readMetadata, context) =>
			options.wrap(
				original,
				publicContext({ kind: "method", name: context.name, static: context.static }, readMetadata, cardinality)
			),
	};
	const factory = buildMethodTarget<TMeta, TArgs, TMethod, TThis, InternalCardinalityOf<TCard>>(
		key,
		annotationOptions,
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

export function accessorInterceptor<TMeta, TArgs extends unknown[], TValue, TThis, TCard extends Cardinality>(
	options: AccessorInterceptorOptions<TMeta, TArgs, TValue, TCard>
): AccessorAnnotation<TMeta, TArgs, TValue, TThis, TCard> {
	const { cardinality, key, options: annotationOptions } = normalizeBuilderInput<TMeta, TArgs, TCard>(options);
	const hookRefs: AccessorHookRefs<TMeta, TValue> = {};
	if (options.get) {
		hookRefs.get = (original, readMetadata, context) =>
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
		hookRefs.set = (original, readMetadata, context) =>
			options.set?.(
				original,
				publicContext(
					{ kind: "accessor", name: context.name, static: context.static },
					readMetadata,
					cardinality
				)
			) ?? original;
	}
	const factory = buildAccessorTarget<TMeta, TArgs, TValue, TThis, InternalCardinalityOf<TCard>>(
		key,
		annotationOptions,
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

export function fieldInterceptor<TMeta, TArgs extends unknown[], TField, TThis, TCard extends Cardinality>(
	options: FieldInterceptorOptions<TMeta, TArgs, TField, TThis, TCard>
): FieldAnnotation<TMeta, TArgs, TField, TThis, TCard> {
	const { cardinality, key, options: annotationOptions } = normalizeBuilderInput<TMeta, TArgs, TCard>(options);
	const hookRefs: FieldHookRefs<TMeta, TField> = {
		init(this: TThis, initial, readMetadata, context) {
			return options.init.call(
				this,
				initial,
				publicContext({ kind: "field", name: context.name, static: context.static }, readMetadata, cardinality)
			);
		},
	};
	const factory = buildFieldInterceptorTarget<TMeta, TArgs, TField, TThis, InternalCardinalityOf<TCard>>(
		key,
		annotationOptions,
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
