/** biome-ignore-all lint/complexity/noVoid: discard class references to avoid unused-variable warnings in test */
/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test stub method */
/** biome-ignore-all lint/style/useThrowOnlyError: exercising non-Error throw paths is the point of these tests */
import { describe, expect, test } from "bun:test";

import { AnnotateErrorCode, InvalidDecorationTargetError, ValidationError } from "../../../src";
import { decorate } from "../../../src/legacy";
import type { ValidateContext } from "../../../src";

const BAD_PING_RE = /bad: ping/;

// Shared base hierarchy for requireInstanceOf class/static scenarios.
class BaseListener {}
class OtherBase {}

describe("validator chain — validate option", () => {
	describe("happy path", () => {
		test("class decorator: validator runs, receives (meta, context), commit succeeds", () => {
			const seen: Array<{ meta: unknown; context: ValidateContext }> = [];
			const Tag = decorate.class<{ slug: string }>({
				name: "Tag",
				validate: (meta, context) => {
					seen.push({ meta, context });
				},
			});

			@Tag({ slug: "svc" })
			class Service {}

			expect(seen).toHaveLength(1);
			expect(seen[0]?.meta).toEqual({ slug: "svc" });
			expect(seen[0]?.context.target).toBe(Service);
			expect(seen[0]?.context.kind).toBe("class");
			expect(seen[0]?.context.memberName).toBeUndefined();
			expect(seen[0]?.context.static).toBe(false);
			expect(Tag.first(Service)).toEqual({ slug: "svc" });
		});

		test("method decorator: validator runs at first `new`", () => {
			const seen: ValidateContext[] = [];
			const Route = decorate.method<string>({
				name: "Route",
				validate: (_meta, context) => {
					seen.push(context);
				},
			});

			class Api {
				@Route("/ping")
				ping(): void {}
			}

			expect(seen).toHaveLength(0);
			new Api();
			expect(seen).toHaveLength(1);
			expect(seen[0]?.target).toBe(Api);
			expect(seen[0]?.memberName).toBe("ping");
			expect(seen[0]?.kind).toBe("method");
			expect(seen[0]?.static).toBe(false);
		});

		test("property decorator: validator runs at first `new`", () => {
			const seen: ValidateContext[] = [];
			const Column = decorate.property<string>({
				name: "Column",
				validate: (_meta, context) => {
					seen.push(context);
				},
			});

			class User {
				@Column("varchar")
				name!: string;
			}

			new User();
			expect(seen).toHaveLength(1);
			expect(seen[0]?.kind).toBe("property");
			expect(seen[0]?.memberName).toBe("name");
			expect(seen[0]?.static).toBe(false);
		});

		test("static method: context.static is true, target is the constructor", () => {
			const seen: ValidateContext[] = [];
			const Cmd = decorate.method<string>({
				name: "Cmd",
				validate: (_meta, context) => {
					seen.push(context);
				},
			});

			// biome-ignore lint/complexity/noStaticOnlyClass: test fixture
			class Cli {
				@Cmd("build")
				static build(): void {}
			}

			expect(seen).toHaveLength(1);
			expect(seen[0]?.target).toBe(Cli);
			expect(seen[0]?.memberName).toBe("build");
			expect(seen[0]?.static).toBe(true);
		});
	});

	describe("error wrapping", () => {
		test("Error instance passes through (same reference)", () => {
			const sentinel = new Error("bad");
			const Tag = decorate.class<string>({
				name: "Tag",
				validate: () => {
					throw sentinel;
				},
			});

			let caught: unknown;
			try {
				@Tag("x")
				class _X {}
				void _X;
			} catch (error) {
				caught = error;
			}
			expect(caught).toBe(sentinel);
		});

		test("non-Error throw is wrapped in ValidationError; cause preserves the thrown value", () => {
			const payload = { why: "nope" };
			const Tag = decorate.class<string>({
				name: "Tag",
				validate: () => {
					throw payload;
				},
			});

			let caught: unknown;
			try {
				@Tag("x")
				class _X {}
				void _X;
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(ValidationError);
			expect((caught as ValidationError).cause).toBe(payload);
			expect((caught as ValidationError).code).toBe(AnnotateErrorCode.VALIDATION);
		});

		test("string throw is extracted as reason", () => {
			const Tag = decorate.class<string>({
				name: "Tag",
				validate: () => {
					throw "invalid value";
				},
			});

			let caught: unknown;
			try {
				@Tag("x")
				class _X {}
				void _X;
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(ValidationError);
			const err = caught as ValidationError;
			expect(err.message).toContain("invalid value");
			expect(err.cause).toBe("invalid value");
		});

		test("object with message property extracts message as reason", () => {
			const payload = { message: "bad value", code: 42 };
			const Tag = decorate.class<string>({
				name: "Tag",
				validate: () => {
					throw payload;
				},
			});

			let caught: unknown;
			try {
				@Tag("x")
				class _X {}
				void _X;
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(ValidationError);
			const err = caught as ValidationError;
			expect(err.message).toContain("bad value");
			expect(err.cause).toBe(payload);
		});

		test("plain object without message uses JSON.stringify as reason", () => {
			const payload = { x: 1, y: 2 };
			const Tag = decorate.class<string>({
				name: "Tag",
				validate: () => {
					throw payload;
				},
			});

			let caught: unknown;
			try {
				@Tag("x")
				class _X {}
				void _X;
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(ValidationError);
			const err = caught as ValidationError;
			expect(err.message).toContain('{"x":1,"y":2}');
			expect(err.cause).toBe(payload);
		});

		test("null throw is stringified as reason", () => {
			const Tag = decorate.class<string>({
				name: "Tag",
				validate: () => {
					throw null;
				},
			});

			let caught: unknown;
			try {
				@Tag("x")
				class _X {}
				void _X;
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(ValidationError);
			const err = caught as ValidationError;
			expect(err.message).toContain("null");
			expect(err.cause).toBe(null);
		});

		test("undefined throw is stringified as reason", () => {
			const Tag = decorate.class<string>({
				name: "Tag",
				validate: () => {
					throw undefined;
				},
			});

			let caught: unknown;
			try {
				@Tag("x")
				class _X {}
				void _X;
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(ValidationError);
			const err = caught as ValidationError;
			expect(err.message).toContain("undefined");
			expect(err.cause).toBeUndefined();
		});

		test("object with empty message string falls back to JSON.stringify", () => {
			const payload = { message: "", value: 123 };
			const Tag = decorate.class<string>({
				name: "Tag",
				validate: () => {
					throw payload;
				},
			});

			let caught: unknown;
			try {
				@Tag("x")
				class _X {}
				void _X;
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(ValidationError);
			const err = caught as ValidationError;
			expect(err.message).toContain('{"message":"","value":123}');
			expect(err.cause).toBe(payload);
		});

		test("circular object reference falls back to [object Object]", () => {
			const payload: Record<string, unknown> = { x: 1 };
			payload.self = payload;
			const Tag = decorate.class<string>({
				name: "Tag",
				validate: () => {
					throw payload;
				},
			});

			let caught: unknown;
			try {
				@Tag("x")
				class _X {}
				void _X;
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(ValidationError);
			const err = caught as ValidationError;
			expect(err.message).toContain("[object Object]");
			expect(err.cause).toBe(payload);
		});

		test("number throw is stringified as reason", () => {
			const Tag = decorate.class<string>({
				name: "Tag",
				validate: () => {
					throw 42;
				},
			});

			let caught: unknown;
			try {
				@Tag("x")
				class _X {}
				void _X;
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(ValidationError);
			const err = caught as ValidationError;
			expect(err.message).toContain("42");
			expect(err.cause).toBe(42);
		});
	});

	describe("ordering and state", () => {
		test("validator receives composed TMeta, not raw TArgs", () => {
			let observed: unknown;
			const Component = decorate.class({
				name: "Component",
				compose: (selector: string, scoped: boolean) => ({ selector, scoped }),
				validate: (meta) => {
					observed = meta;
				},
			});

			@Component("app-root", true)
			class Root {}
			void Root;

			expect(observed).toEqual({ selector: "app-root", scoped: true });
		});

		test("instance-member: throw surfaces at first `new`, not at class-body eval", () => {
			const Route = decorate.method<string>({
				name: "Route",
				validate: (meta) => {
					if (!(meta as string).startsWith("/")) {
						throw new Error(`bad: ${meta}`);
					}
				},
			});

			// Class body evaluates without throwing.
			class Api {
				@Route("ping")
				ping(): void {}
			}

			expect(() => new Api()).toThrow(BAD_PING_RE);
		});
	});
});

describe("validator chain — requireInstanceOf", () => {
	describe("class decorator", () => {
		test("valid subclass commits at class-body eval", () => {
			const Listen = decorate.class<string>({
				name: "Listen",
				requireInstanceOf: BaseListener,
			});

			@Listen("chat")
			class ChatListener extends BaseListener {}

			expect(Listen.first(ChatListener)).toBe("chat");
		});

		test("unrelated class throws InvalidDecorationTargetError at class-body eval", () => {
			const Listen = decorate.class<string>({
				name: "Listen",
				requireInstanceOf: BaseListener,
			});

			let caught: unknown;
			try {
				@Listen("wrong")
				class _Wrong extends OtherBase {}
				void _Wrong;
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(InvalidDecorationTargetError);
			expect((caught as InvalidDecorationTargetError).requiredBase).toBe(BaseListener);
		});
	});

	describe("static member", () => {
		test("valid class commits", () => {
			const Cmd = decorate.method<string>({
				name: "Cmd",
				requireInstanceOf: BaseListener,
			});

			class Cli extends BaseListener {
				@Cmd("run")
				static run(): void {}
			}

			expect(Cmd.first(Cli, "run")).toBe("run");
		});

		test("invalid class throws at class-body eval with memberName populated", () => {
			const Cmd = decorate.method<string>({
				name: "Cmd",
				requireInstanceOf: BaseListener,
			});

			let caught: unknown;
			try {
				class _Wrong extends OtherBase {
					@Cmd("run")
					static run(): void {}
				}
				void _Wrong;
			} catch (error) {
				caught = error;
			}
			expect(caught).toBeInstanceOf(InvalidDecorationTargetError);
			const err = caught as InvalidDecorationTargetError;
			expect(err.requiredBase).toBe(BaseListener);
			expect(err.memberName).toBe("run");
			expect(err.kind).toBe("method");
		});
	});

	describe("instance member", () => {
		test("invalid subclass throws at first `new`, not at class-body eval", () => {
			const Route = decorate.method<string>({
				name: "Route",
				requireInstanceOf: BaseListener,
			});

			class WrongApi extends OtherBase {
				@Route("/ping")
				ping(): void {}
			}

			expect(() => new WrongApi()).toThrow(InvalidDecorationTargetError);
		});
	});

	describe("Bun-bug resilience", () => {
		test("two classes with different bases materialize independently", () => {
			const ListenA = decorate.method<string>({
				name: "ListenA",
				requireInstanceOf: BaseListener,
			});
			const ListenB = decorate.method<string>({
				name: "ListenB",
				requireInstanceOf: OtherBase,
			});

			class A extends BaseListener {
				@ListenA("a")
				handle(): void {}
			}
			class B extends OtherBase {
				@ListenB("b")
				handle(): void {}
			}

			// Construct in reverse registration order; neither should throw.
			new B();
			new A();
			expect(ListenA.first(A, "handle")).toBe("a");
			expect(ListenB.first(B, "handle")).toBe("b");
		});
	});

	describe("reader-triggered materialize", () => {
		test("has(...) throws out of the reader when decoration is invalid", () => {
			const Route = decorate.method<string>({
				name: "Route",
				requireInstanceOf: BaseListener,
			});

			class WrongApi extends OtherBase {
				@Route("/ping")
				ping(): void {}
			}

			expect(() => Route.has(WrongApi, "ping")).toThrow(InvalidDecorationTargetError);
		});
	});
});
