import { InvalidDecorationTargetError, ValidationError } from "../errors";
import type { DeferredValidatorFn, MetadataKey } from "../metadata/types";
import type { AnyConstructor } from "../reflector/types";
import type { ValidateContext, ValidatorFn } from "./validator-types";

function wrapUserValidate<TMeta>(fn: ValidatorFn<TMeta>, label: string, key: MetadataKey): ValidatorFn<TMeta> {
	return (meta, context) => {
		try {
			fn(meta, context);
		} catch (error) {
			if (error instanceof Error) {
				throw error;
			}
			throw new ValidationError({
				label,
				target: context.target,
				reason: String(error),
				kind: context.kind,
				memberName: context.memberName,
				key,
				cause: error,
			});
		}
	};
}

/**
 * Composes `requireInstanceOf` and `validate` from decorator options into an
 * ordered list. Instance checks run first; user `validate` is wrapped so
 * non-Error throws become {@link ValidationError}.
 */
export function buildValidatorChain<TMeta>(
	options: { validate?: ValidatorFn<TMeta>; requireInstanceOf?: AnyConstructor } | undefined,
	label: string,
	key: MetadataKey
): ValidatorFn<TMeta>[] | undefined {
	const requiredBase = options?.requireInstanceOf;
	const userValidate = options?.validate;
	if (!(requiredBase || userValidate)) {
		return;
	}
	const chain: ValidatorFn<TMeta>[] = [];
	if (requiredBase) {
		chain.push((_meta, context) => {
			if (context.target === requiredBase || context.target.prototype instanceof requiredBase) {
				return;
			}
			throw new InvalidDecorationTargetError({
				label,
				target: context.target,
				requiredBase,
				kind: context.kind,
				memberName: context.memberName,
				key,
			});
		});
	}
	if (userValidate) {
		chain.push(wrapUserValidate(userValidate, label, key));
	}
	return chain;
}

/** Runs each validator in order; the first throw aborts the chain. */
export function runValidatorChain<TMeta>(
	chain: readonly ValidatorFn<TMeta>[],
	meta: TMeta,
	context: ValidateContext
): void {
	for (const validator of chain) {
		validator(meta, context);
	}
}

/** Bridges typed {@link ValidatorFn} chains to the deferred-queue storage shape. */
export function asDeferredValidators<TMeta>(chain: readonly ValidatorFn<TMeta>[]): readonly DeferredValidatorFn[] {
	return chain as unknown as readonly DeferredValidatorFn[];
}

/**
 * Returns a single validator that runs `parent` then `child`, or whichever side
 * is defined. Used when merging base and derived decorator validation.
 */
export function chainValidators<TMeta>(
	parent: ValidatorFn<TMeta> | undefined,
	child: ValidatorFn<TMeta> | undefined
): ValidatorFn<TMeta> | undefined {
	if (!(parent || child)) {
		return;
	}
	if (!parent) {
		return child;
	}
	if (!child) {
		return parent;
	}
	return (meta, context) => {
		parent(meta, context);
		child(meta, context);
	};
}
