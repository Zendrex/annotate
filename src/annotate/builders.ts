import { buildAccessorFactory } from "../factories/accessor-interceptor";
import { buildClassFactory } from "../factories/class-decorator";
import { buildFieldFactory } from "../factories/field-interceptor";
import { buildMethodFactory } from "../factories/method-decorator";
import { buildPropertyFactory } from "../factories/property-decorator";
import { normalizeBuilderInput } from "./normalize-input";
import { attachClassRead, attachMemberRead, publicContext } from "./readers";
import type { AccessorHookRefs } from "../factories/accessor-interceptor";
import type { FieldHookRefs } from "../factories/field-interceptor";
import type { MethodHookRefs } from "../factories/method-decorator";
import type { AnyFn } from "../factories/types";
import type { BuilderInput, InternalCardinalityOf } from "./normalize-input";
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
	const factory = buildClassFactory<TMeta, TArgs, TInstance, InternalCardinalityOf<TCard>>(key, options);
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
	const factory = buildMethodFactory<TMeta, TArgs, TMethod, TThis, InternalCardinalityOf<TCard>>(key, options);
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

export function accessorAnnotation<TMeta, TArgs extends unknown[], TValue, TThis, TCard extends Cardinality>(
	input?: BuilderInput<TMeta, TArgs, TCard>
): AccessorAnnotation<TMeta, TArgs, TValue, TThis, TCard> {
	const { cardinality, key, options } = normalizeBuilderInput<TMeta, TArgs, TCard>(input);
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

export function methodInterceptor<
	TMeta,
	TArgs extends unknown[],
	TMethod extends AnyFn,
	TThis,
	TCard extends Cardinality,
>(
	options: MethodInterceptorOptions<TMeta, TArgs, TMethod, TCard>
): MethodAnnotation<TMeta, TArgs, TMethod, TThis, TCard> {
	const { cardinality, key, options: legacyOptions } = normalizeBuilderInput<TMeta, TArgs, TCard>(options);
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

export function accessorInterceptor<TMeta, TArgs extends unknown[], TValue, TThis, TCard extends Cardinality>(
	options: AccessorInterceptorOptions<TMeta, TArgs, TValue, TCard>
): AccessorAnnotation<TMeta, TArgs, TValue, TThis, TCard> {
	const { cardinality, key, options: legacyOptions } = normalizeBuilderInput<TMeta, TArgs, TCard>(options);
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

export function fieldInterceptor<TMeta, TArgs extends unknown[], TField, TThis, TCard extends Cardinality>(
	options: FieldInterceptorOptions<TMeta, TArgs, TField, TCard>
): FieldAnnotation<TMeta, TArgs, TField, TThis, TCard> {
	const { cardinality, key, options: legacyOptions } = normalizeBuilderInput<TMeta, TArgs, TCard>(options);
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
