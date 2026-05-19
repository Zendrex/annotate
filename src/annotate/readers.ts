import { collectClassMeta } from "../metadata/stores/class-meta-store";
import { collectMemberMeta, snapshotMembers } from "../metadata/stores/member-meta-store";
import { targetDisplayName } from "../reflector/class-name";
import { resolveReflectTarget } from "../reflector/resolve-instance";
import { prepare } from "../runtime/prepare";
import { formatMetadata, formatRead } from "./format";
import { resolveSelector } from "./selector";
import type { MemberKind, MetadataKey } from "../metadata/types";
import type { AnyConstructor } from "../reflector/types";
import type {
	Cardinality,
	ClassAnnotationEntry,
	ClassAnnotationReader,
	MemberAnnotationEntry,
	MemberAnnotationReader,
	PublicInterceptorContext,
} from "./types";

export function prepareTarget(target: object): AnyConstructor {
	const ctor = resolveReflectTarget(target);
	prepare(ctor);
	return ctor;
}

export function publicContext<TMeta, TCard extends Cardinality>(
	base: { kind: "method" | "field" | "accessor"; name: string | symbol; static: boolean },
	readMetadata: (instance: object) => TMeta[],
	cardinality: TCard
): PublicInterceptorContext<TMeta, TCard> {
	return {
		...base,
		get: (instance) => formatRead(readMetadata(instance), cardinality),
	};
}

export function createClassReader<TMeta, TCard extends Cardinality>(
	key: MetadataKey<TMeta>,
	cardinality: TCard,
	target: object
): ClassAnnotationReader<TMeta, TCard> {
	const ctor = prepareTarget(target);
	return {
		entries: () => {
			const values = collectClassMeta<TMeta>(ctor, key);
			if (values.length === 0) {
				return [];
			}
			return [
				{
					kind: "class",
					metadata: formatMetadata<TMeta, TCard>(values, cardinality),
					name: targetDisplayName(ctor),
					target: ctor,
				},
			] as ClassAnnotationEntry<TMeta, TCard>[];
		},
		get: () => formatRead(collectClassMeta<TMeta>(ctor, key), cardinality),
	};
}

export function createMemberReader<TMeta, TCard extends Cardinality, TThis>(
	key: MetadataKey<TMeta>,
	cardinality: TCard,
	target: object
): MemberAnnotationReader<TMeta, TCard, TThis, AnyConstructor> {
	const ctor = prepareTarget(target);

	const entriesFor = (kind?: Extract<MemberKind, "method" | "field" | "accessor">) => {
		const entries: MemberAnnotationEntry<TMeta, TCard>[] = [];
		for (const [name, entry] of snapshotMembers(ctor, key)) {
			if (entry.values.length === 0 || (kind && entry.kind !== kind)) {
				continue;
			}
			if (entry.kind !== "method" && entry.kind !== "field" && entry.kind !== "accessor") {
				continue;
			}
			entries.push({
				kind: entry.kind,
				metadata: formatMetadata<TMeta, TCard>(entry.values, cardinality),
				name,
				static: entry.static,
			});
		}
		return entries;
	};

	return {
		static: {
			get: (selector) => {
				const name = resolveSelector(ctor, selector as (target: never) => unknown);
				return formatRead(collectMemberMeta<TMeta>(ctor, key, name), cardinality);
			},
		},
		accessors: () => entriesFor("accessor"),
		entries: () => entriesFor(),
		fields: () => entriesFor("field"),
		get: (selector) => {
			const name = resolveSelector(ctor, selector as (target: never) => unknown);
			return formatRead(collectMemberMeta<TMeta>(ctor, key, name), cardinality);
		},
		methods: () => entriesFor("method"),
	};
}

export function attachClassRead<TFactory extends object, TMeta, TCard extends Cardinality>(
	factory: TFactory,
	key: MetadataKey<TMeta>,
	cardinality: TCard
): TFactory & { read(target: object): ClassAnnotationReader<TMeta, TCard> } {
	return Object.assign(factory, {
		read: (target: object) => createClassReader<TMeta, TCard>(key, cardinality, target),
	});
}

export function attachMemberRead<TFactory extends object, TMeta, TCard extends Cardinality, TThis>(
	factory: TFactory,
	key: MetadataKey<TMeta>,
	cardinality: TCard
): TFactory & { read(target: object): MemberAnnotationReader<TMeta, TCard, TThis, AnyConstructor> } {
	return Object.assign(factory, {
		read: (target: object) => createMemberReader<TMeta, TCard, TThis>(key, cardinality, target),
	});
}
