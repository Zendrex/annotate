import type { AnyConstructor, DecoratedKind } from "../reflector/types";

export interface ValidateContext {
	kind: DecoratedKind;
	memberName?: string | symbol;
	static: boolean;
	target: AnyConstructor;
}

export type ValidatorFn<TMeta> = (meta: TMeta, context: ValidateContext) => void;
