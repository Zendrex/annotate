/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test file */
/** biome-ignore-all lint/complexity/noVoid: discard class reference to avoid unused-variable warning in test */
/** biome-ignore-all lint/suspicious/useAwait: async keyword is the constraint under test — no real await needed */
import { decorate, intercept } from "../../../src";

interface Meta {
	v: string;
}

// --- decorate.property type constraints ---

const NumberField = decorate.property<Meta, [Meta], number>();

class P_AcceptNumber {
	@NumberField({ v: "v" })
	ok!: number;
}
void P_AcceptNumber;

class P_AcceptLiteral {
	@NumberField({ v: "v" })
	narrow!: 1 | 2 | 3;
}
void P_AcceptLiteral;

class P_AcceptOptional {
	// @ts-expect-error: number-bound rejects optional (number | undefined) field
	@NumberField({ v: "v" })
	maybe?: number;
}
void P_AcceptOptional;

class P_AcceptAny {
	// any-typed fields always pass — documented loophole
	@NumberField({ v: "v" })
	// biome-ignore lint/suspicious/noExplicitAny: documented loophole test
	loose!: any;
}
void P_AcceptAny;

class P_RejectBoolean {
	// @ts-expect-error: number-bound rejects boolean field
	@NumberField({ v: "v" })
	flag!: boolean;
}
void P_RejectBoolean;

class P_RejectUnion {
	// @ts-expect-error: number-bound rejects wider union
	@NumberField({ v: "v" })
	either!: number | string;
}
void P_RejectUnion;

class P_RejectUnknown {
	// @ts-expect-error: number-bound rejects unknown
	@NumberField({ v: "v" })
	free!: unknown;
}
void P_RejectUnknown;

class Animal {
	breathe(): void {}
}
class Dog extends Animal {
	bark(): void {}
}
const DogField = decorate.property<Meta, [Meta], Dog>();

class P_RejectSupertype {
	// @ts-expect-error: Dog-bound rejects Animal supertype
	@DogField({ v: "v" })
	pet!: Animal;
}
void P_RejectSupertype;

const PermissiveField = decorate.property<Meta>();
class P_PermissiveAccepts {
	@PermissiveField({ v: "v" })
	whatever!: { complex: { type: () => boolean } };
}
void P_PermissiveAccepts;

// --- decorate.class type constraints ---

class Component {
	render(): void {}
}
const Cmp = decorate.class<Meta, [Meta], Component>();

@Cmp({ v: "v" })
class C_Ok extends Component {}
void C_Ok;

// @ts-expect-error: not a Component subclass
@Cmp({ v: "v" })
class C_NotComponent {}
void C_NotComponent;

// --- decorate.method type constraints ---

const AsyncOnly = decorate.method<Meta, [Meta], (...a: unknown[]) => Promise<unknown>>();

class M_AsyncOk {
	@AsyncOnly({ v: "v" })
	async run(): Promise<unknown> {
		return Promise.resolve();
	}
}
void M_AsyncOk;

class M_RejectSync {
	// @ts-expect-error: sync method rejected by async-only constraint
	@AsyncOnly({ v: "v" })
	run(): void {}
}
void M_RejectSync;

// --- intercept.accessor: rejects plain field application ---

const Acc = intercept.accessor<Meta, [Meta], number>({
	onGet: (original) => original,
});

class A_Ok {
	@Acc({ v: "v" })
	accessor x = 0;
}
void A_Ok;

class A_RejectField {
	// @ts-expect-error: accessor-only decorator rejected on plain field
	@Acc({ v: "v" })
	x!: number;
}
void A_RejectField;
