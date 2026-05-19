/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: test fixture methods */
/** biome-ignore-all lint/style/useThrowOnlyError: validation wraps non-Error throws */
/** biome-ignore-all lint/complexity/noVoid: discard decorator fixture class references */

import { describe, expect, test } from "bun:test";

import { Annotate, AnnotateErrorCode, InvalidDecorationTargetError, ValidationError } from "../../src";
import type { ValidateContext } from "../../src";

class Base {}
class OtherBase {}

describe("Annotate validation", () => {
	test("requires rejects classes outside the required base", () => {
		const Controller = Annotate.class<string>({ label: "Controller", requires: Base });

		expect(() => {
			@Controller("bad")
			class Subject {}
			void Subject;
		}).toThrow(InvalidDecorationTargetError);
	});

	test("validate receives mapped metadata", () => {
		const Route = Annotate.method<{ path: string }, [string]>({
			label: "Route",
			args: (path: string) => ({ path }),
			validate(route) {
				if (!route.path.startsWith("/")) {
					throw "path must start with /";
				}
			},
		});

		expect(() => {
			class Api {
				@Route("bad")
				index(): void {}
			}
			new Api();
		}).toThrow(ValidationError);
	});

	test("class validators receive metadata and class context", () => {
		const seen: Array<{ context: ValidateContext; meta: { slug: string } }> = [];
		const Tag = Annotate.class<{ slug: string }>({
			label: "Tag",
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
		expect(Tag.read(Service).get()).toEqual({ slug: "svc" });
	});

	test("member validators run when instance metadata materializes", () => {
		const seen: ValidateContext[] = [];
		const Route = Annotate.method<string>({
			label: "Route",
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

	test("non-Error validation throws are wrapped and preserve cause", () => {
		const payload = { why: "nope" };
		const Tag = Annotate.class<string>({
			label: "Tag",
			validate: () => {
				throw payload;
			},
		});

		let caught: unknown;
		try {
			@Tag("x")
			class Subject {}
			void Subject;
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(ValidationError);
		expect((caught as ValidationError).cause).toBe(payload);
		expect((caught as ValidationError).code).toBe(AnnotateErrorCode.VALIDATION);
	});

	test("requires accepts valid subclasses and rejects invalid instance members on materialization", () => {
		const Route = Annotate.method<string>({ label: "Route", requires: Base });

		class Good extends Base {
			@Route("/ok")
			index(): void {}
		}

		class Bad extends OtherBase {
			@Route("/bad")
			index(): void {}
		}

		expect(() => new Good()).not.toThrow();
		expect(Route.read(Good).get((target) => target.index)).toBe("/ok");
		expect(() => new Bad()).toThrow(InvalidDecorationTargetError);
	});
});
