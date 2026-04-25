import { describe, expect, test } from "bun:test";

import { decorate } from "../../src";

// Regression guards against Bun 1.3.13's Stage-3 bug where instance-member
// `addInitializer` callbacks are globally shared across classes: only the last
// registration survives and fires on every instance. Annotate's instance
// initializer body references only `this.constructor`, so whichever
// initializer Bun actually invokes drains the real class's pending metadata
// via `materialize`. These tests fail if that invariant regresses.

interface Tagged {
	readonly tag: string;
}

describe("cross-class member isolation", () => {
	test("property decorator on two classes does not cross-pollute after construction", () => {
		const Prop = decorate.property<Tagged, [string]>({ compose: (tag) => ({ tag }) });
		const Tag = decorate.class<void, []>();

		@Tag()
		class Alpha {
			@Prop("alpha") a = 1;
		}
		@Tag()
		class Beta {
			@Prop("beta") b = 2;
		}

		new Alpha();
		new Beta();

		const alphaProps = Prop.reader(Alpha).properties();
		const betaProps = Prop.reader(Beta).properties();

		expect(alphaProps.map((p) => p.name)).toEqual(["a"]);
		expect(betaProps.map((p) => p.name)).toEqual(["b"]);
		expect(alphaProps[0]?.metadata).toEqual([{ tag: "alpha" }]);
		expect(betaProps[0]?.metadata).toEqual([{ tag: "beta" }]);
	});

	test("bare-member-decorator class: metadata readable after reflect via materialize", () => {
		const Prop = decorate.property<Tagged, [string]>({ compose: (tag) => ({ tag }) });

		class Bare {
			@Prop("only") x = 1;
		}

		// No class decorator and no instance yet — reflect() must trigger
		// materialize so pending deferreds surface.
		const props = Prop.reader(Bare).properties();
		expect(props.map((p) => p.name)).toEqual(["x"]);
		expect(props[0]?.metadata).toEqual([{ tag: "only" }]);
	});
});
