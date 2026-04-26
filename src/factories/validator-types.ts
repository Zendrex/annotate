import type { AnyConstructor, DecoratedKind } from "../reflector/types";

/**
 * Context passed to {@link ValidatorFn} when metadata is validated (on flush
 * for deferred storage). `target` + `kind` distinguish class vs member rules;
 * `static` and `memberName` disambiguate member-level checks.
 */
export interface ValidateContext {
	kind: DecoratedKind;
	memberName?: string | symbol;
	static: boolean;
	target: AnyConstructor;
}

/**
 * Validates metadata before commit. Throw to reject the value; non-Error
 * throws are wrapped as {@link ValidationError} when raised through user
 * `validate` options.
 */
export type ValidatorFn<TMeta> = (meta: TMeta, context: ValidateContext) => void;
