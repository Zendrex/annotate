/** biome-ignore-all lint/suspicious/noExplicitAny: public decorator handles default to permissive target types unless callers constrain them */
import {
	accessorAnnotation,
	accessorInterceptor,
	classAnnotation,
	fieldAnnotation,
	fieldInterceptor,
	methodAnnotation,
	methodInterceptor,
} from "./builders";
import type { AnyFn } from "../factories/types";
import type {
	AccessorAnnotation,
	AccessorInterceptorOptions,
	AnnotationArgsOptions,
	AnnotationOptions,
	Cardinality,
	ClassAnnotation,
	FieldAnnotation,
	FieldInterceptorOptions,
	MethodAnnotation,
	MethodInterceptorOptions,
} from "./types";

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

export type { ValidateContext } from "../factories/validator-types";
export type {
	AccessorAnnotation,
	AccessorInterceptorOptions,
	AnnotationArgsOptions,
	AnnotationOptions,
	Cardinality,
	ClassAnnotation,
	ClassAnnotationEntry,
	ClassAnnotationReader,
	FieldAnnotation,
	FieldInterceptorOptions,
	MemberAnnotationEntry,
	MemberAnnotationReader,
	MethodAnnotation,
	MethodInterceptorOptions,
	PublicInterceptorContext,
} from "./types";
