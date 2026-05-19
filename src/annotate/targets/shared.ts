import { keyDisplayName } from "../../errors";
import { collectMemberMeta } from "../../metadata/store";
import { buildValidatorChain } from "../validation";
import type { Ctor, MetadataKey } from "../../metadata/types";
import type { InternalAnnotationOptions } from "../internal-types";
import type { ValidatorFn } from "../validation";

export function mapArgs<TMeta>(args: [TMeta]): TMeta;
export function mapArgs<TMeta, TArgs extends unknown[]>(
	args: TArgs,
	mapper: ((...args: TArgs) => TMeta) | undefined
): TMeta;
export function mapArgs<TMeta, TArgs extends unknown[]>(args: TArgs, mapper?: (...args: TArgs) => TMeta): TMeta {
	return mapper ? mapper(...args) : (args[0] as TMeta);
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

export function prepareTargetBuilder<TMeta, TArgs extends unknown[]>(
	key: MetadataKey<TMeta>,
	options: InternalAnnotationOptions<TMeta, TArgs> | undefined
): {
	argsMapper: ((...args: TArgs) => TMeta) | undefined;
	validators: ValidatorFn<TMeta>[] | undefined;
} {
	const { args: argsMapper, label } = options ?? {};
	const labelOrKey = label ?? keyDisplayName(key);
	const validators = buildValidatorChain<TMeta>(options, labelOrKey, key);
	return { argsMapper, validators };
}
