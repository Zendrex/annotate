import type { AnyConstructor } from "../reflector/types";
import type { Cardinality } from "./types";
import type { ValidatorFn } from "./validation-types";

// biome-ignore lint/suspicious/noExplicitAny: public method decorators must preserve arbitrary function signatures
export type AnyFn = (...args: any[]) => any;

export type AnyClass<TInstance> = abstract new (...args: never[]) => TInstance;

export interface InternalInterceptorContext {
	kind: "method" | "accessor" | "field";
	name: string | symbol;
	static: boolean;
}

type ArgsRequirement<TMeta, TArgs extends unknown[]> = [TArgs] extends [[TMeta]]
	? { args?: (...args: TArgs) => TMeta }
	: { args: (...args: TArgs) => TMeta };

export type InternalAnnotationOptions<TMeta, TArgs extends unknown[] = [TMeta]> = {
	label?: string;
	requires?: AnyConstructor;
	validate?: ValidatorFn<TMeta>;
} & ArgsRequirement<TMeta, TArgs>;

export type InternalCardinalityOf<TCard extends Cardinality> = TCard extends "many" ? "list" : "unique";

export interface MethodHookRefs<TMeta, TMethod extends AnyFn> {
	wrap: (
		original: TMethod,
		readMetadata: (instance: object) => TMeta[],
		context: InternalInterceptorContext
	) => TMethod;
}

export interface AccessorHookRefs<TMeta, TValue> {
	get?: (
		original: () => TValue,
		readMetadata: (instance: object) => TMeta[],
		context: InternalInterceptorContext
	) => () => TValue;
	set?: (
		original: (value: TValue) => void,
		readMetadata: (instance: object) => TMeta[],
		context: InternalInterceptorContext
	) => (value: TValue) => void;
}

export interface FieldHookRefs<TMeta, TField> {
	init: (initial: TField, readMetadata: (instance: object) => TMeta[], context: InternalInterceptorContext) => TField;
}
