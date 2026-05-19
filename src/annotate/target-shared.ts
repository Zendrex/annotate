import { keyDisplayName } from "../errors";
import { registerCtor } from "../metadata/pipeline/ctor-correlation";
import { flushFor, queueDeferred } from "../metadata/pipeline/deferred-queue";
import { appendMemberMeta, collectMemberMeta } from "../metadata/stores/member-meta-store";
import { prepare } from "../runtime/prepare";
import { walkPrototypeChain } from "../runtime/prototype-chain";
import { asDeferredValidators, buildValidatorChain, runValidatorChain } from "./validation";
import type { Ctor, Deferred, MemberKind, MetadataKey } from "../metadata/types";
import type { AnyConstructor } from "../reflector/types";
import type { InternalAnnotationOptions } from "./internal-types";
import type { ValidateContext, ValidatorFn } from "./validation-types";

export function mapArgs<TMeta>(args: [TMeta]): TMeta;
export function mapArgs<TMeta, TArgs extends unknown[]>(
	args: TArgs,
	mapper: ((...args: TArgs) => TMeta) | undefined
): TMeta;
export function mapArgs<TMeta, TArgs extends unknown[]>(args: TArgs, mapper?: (...args: TArgs) => TMeta): TMeta {
	return mapper ? mapper(...args) : (args[0] as TMeta);
}

export function labelFor(label: string | undefined, key: MetadataKey): string {
	return label ?? keyDisplayName(key);
}

export function prepareTargetBuilder<TMeta, TArgs extends unknown[]>(
	key: MetadataKey<TMeta>,
	options: InternalAnnotationOptions<TMeta, TArgs> | undefined
): {
	argsMapper: ((...args: TArgs) => TMeta) | undefined;
	label: string;
	validators: ValidatorFn<TMeta>[] | undefined;
} {
	const { args: argsMapper, label } = options ?? {};
	const displayLabel = labelFor(label, key);
	const validators = buildValidatorChain<TMeta>(options, displayLabel, key);
	return { argsMapper, label: displayLabel, validators };
}

export function createMemberMetadataReader<TMeta>(
	key: MetadataKey<TMeta>,
	memberName: string | symbol,
	isStatic: boolean
): (instance: object) => TMeta[] {
	return (instance: object): TMeta[] => {
		const ctor = isStatic ? (instance as unknown as Ctor) : (instance as { constructor: Ctor }).constructor;
		return collectMemberMeta<TMeta>(ctor, key, memberName);
	};
}

interface MemberEmitContext {
	addInitializer(initializer: (this: unknown) => void): void;
	readonly metadata: object | null;
	readonly name: string | symbol;
	readonly static: boolean;
}

export function commitDecoration<TMeta>(params: {
	append: () => void;
	correlation: object | null;
	ctor: Ctor;
	meta: TMeta;
	validationContext: ValidateContext;
	validators?: readonly ValidatorFn<TMeta>[];
}): void {
	const { append, correlation, ctor, meta, validationContext, validators } = params;
	if (validators) {
		runValidatorChain(validators, meta, validationContext);
	}
	append();
	registerCtor(ctor, correlation);
	flushFor(ctor, correlation);
}

export function emitMemberDecoration<TMeta>(params: {
	context: MemberEmitContext;
	key: MetadataKey;
	kind: MemberKind;
	meta: TMeta;
	token: symbol;
	validators?: readonly ValidatorFn<TMeta>[];
}): void {
	const { context, key, kind, meta, token, validators } = params;
	const correlation = context.metadata;
	const memberName = context.name;
	const isStatic = context.static;

	if (isStatic) {
		context.addInitializer(function (this: unknown) {
			const ctor = this as Ctor;
			commitDecoration({
				ctor,
				correlation,
				meta,
				validators,
				validationContext: {
					target: ctor as AnyConstructor,
					memberName,
					kind,
					static: true,
				},
				append: () => {
					appendMemberMeta(ctor, key, memberName, meta, token, { static: true, kind });
				},
			});
		});
		return;
	}

	const deferred: Deferred = {
		key,
		name: memberName,
		meta,
		token,
		static: false,
		kind,
	};
	if (validators) {
		deferred.validators = asDeferredValidators(validators);
	}
	queueDeferred(correlation, deferred);
	context.addInitializer(function (this: unknown) {
		walkPrototypeChain((this as { constructor: Ctor }).constructor, (ctor) => {
			prepare(ctor);
		});
	});
}
