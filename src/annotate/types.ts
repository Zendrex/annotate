/** biome-ignore-all lint/suspicious/noExplicitAny: public decorator handles default to permissive target types unless callers constrain them */
import type { AnyConstructor } from "../reflector/types";
import type { AnyFn } from "./internal-types";
import type { ValidatorFn } from "./validation-types";

export type Cardinality = "one" | "many";

export type ReadResult<TMeta, TCard extends Cardinality> = TCard extends "many" ? readonly TMeta[] : TMeta | undefined;

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

interface BuilderOptionsInputBase<TMeta, TArgs extends unknown[], TCard extends Cardinality>
	extends AnnotationOptions<TMeta, TCard> {
	args?: (...args: TArgs) => TMeta;
}

export type MethodInterceptorOptions<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TMethod extends AnyFn = AnyFn,
	TCard extends Cardinality = "one",
> = BuilderOptionsInputBase<TMeta, TArgs, TCard> & {
	wrap: (original: TMethod, context: PublicInterceptorContext<TMeta, TCard>) => TMethod;
};

export type AccessorInterceptorOptions<
	TMeta,
	TArgs extends unknown[] = [TMeta],
	TValue = unknown,
	TCard extends Cardinality = "one",
> = BuilderOptionsInputBase<TMeta, TArgs, TCard> & {
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
	TThis = unknown,
	TCard extends Cardinality = "one",
> = BuilderOptionsInputBase<TMeta, TArgs, TCard> & {
	init: (this: TThis, initial: TField, context: PublicInterceptorContext<TMeta, TCard>) => TField;
};
