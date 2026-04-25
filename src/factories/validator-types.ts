import type { AnyConstructor, DecoratedKind } from "../reflector/types";

/**
 * Context passed to {@link ValidatorFn} when metadata is validated (on flush for
 * deferred storage). Use `target` and `kind` for class vs member rules; `static`
 * and `memberName` disambiguate member-level checks.
 */
export interface ValidateContext {
	kind: DecoratedKind;
	memberName?: string | symbol;
	static: boolean;
	target: AnyConstructor;
}

/**
 * Validates metadata before it is committed. Throw to reject the value; the
 * library wraps non-Error throws as {@link ValidationError} where appropriate.
 */
export type ValidatorFn<TMeta> = (meta: TMeta, context: ValidateContext) => void;
