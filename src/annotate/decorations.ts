import { flushFor, prepare, queueDeferred, registerCtor } from "../metadata/pipeline";
import { appendMemberMeta } from "../metadata/store";
import { walkPrototypeChain } from "../runtime/prototype-chain";
import { asDeferredValidators, runValidatorChain } from "./validation";
import type { Ctor, Deferred, MemberKind, MetadataKey } from "../metadata/types";
import type { AnyConstructor } from "../reflector/types";
import type { ValidateContext, ValidatorFn } from "./validation";

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
