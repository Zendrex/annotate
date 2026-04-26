/** biome-ignore-all lint/complexity/noVoid: discard class references to avoid unused-variable warnings in test */
import { describe, expect, test } from "bun:test";

import { decorate, UnregisteredClassError } from "../../../src";
import { commitDecoration } from "../../../src/factories/shared";
import { mintUniqueKey } from "../../../src/metadata/cardinality-registry";
import { getMemberMeta } from "../../../src/metadata/member-meta-store";
import { queueDeferred } from "../../../src/metadata/metadata-deferred-queue";

describe("decorate.class — all() shape", () => {
	test("all() is one-element and frozen; reader class metadata is scalar; bare ctor throws on all()", () => {
		const Tag = decorate.class<string>();
		const Other = decorate.class<string>();

		@Tag("a")
		class T1 {}
		expect(Tag.all(T1)).toEqual(["a"]);
		expect(Object.isFrozen(Tag.all(T1))).toBe(true);
		expect(Tag.reader(T1).class()?.metadata).toBe("a");

		@Other("x")
		class T2 {}
		expect(Tag.all(T2)).toEqual([]);

		class Bare {}
		expect(() => Tag.all(Bare)).toThrow(UnregisteredClassError);
	});
});

describe("commitDecoration — protocol ordering", () => {
	test("validators run before append, and append runs before registerCtor/flushFor", () => {
		const calls: string[] = [];

		// A fresh correlation object simulates the decorator-context metadata bag.
		const correlation = Object.create(null) as object;

		// Pre-queue a deferred member so flushFor has observable work: if it ran
		// after registerCtor the member meta will be present; if skipped, it won't.
		const memberKey = mintUniqueKey<string>("ordering-test");
		const memberToken = Symbol("ordering-test-token");
		queueDeferred(correlation, {
			key: memberKey,
			name: "field",
			meta: "deferred-value",
			token: memberToken,
			static: false,
			kind: "property",
		});

		class OrderingFixture {}

		commitDecoration({
			ctor: OrderingFixture,
			correlation,
			meta: "class-value",
			validators: [
				(_meta, _context) => {
					calls.push("validate");
				},
			],
			validationContext: {
				target: OrderingFixture,
				kind: "class",
				static: false,
			},
			append: () => {
				calls.push("append");
			},
		});

		// validate must precede append in the call log.
		expect(calls).toEqual(["validate", "append"]);

		// flushFor must have run after registerCtor: the pre-queued deferred member
		// is now committed to the member store under OrderingFixture.
		const flushed = getMemberMeta<string>(OrderingFixture, memberKey, "field");
		expect(flushed).toEqual(["deferred-value"]);
	});

	test("append is called exactly once even when no validators are provided", () => {
		const calls: string[] = [];
		const correlation = Object.create(null) as object;

		class AppendOnceFixture {}

		commitDecoration({
			ctor: AppendOnceFixture,
			correlation,
			meta: "val",
			validationContext: {
				target: AppendOnceFixture,
				kind: "class",
				static: false,
			},
			append: () => {
				calls.push("append");
			},
		});

		expect(calls).toEqual(["append"]);
	});
});

describe("reader prepares deferred instance-member metadata (asymmetry fix)", () => {
	test("reader flushes pending deferred instance members like sibling helpers do", () => {
		const Field = decorate.property<string>();

		class User {
			@Field("varchar")
			name!: string;

			@Field("text")
			bio!: string;
		}

		// reader should prepare just like first/all do, flushing deferred instance members
		const reader = Field.reader(User);
		const properties = reader.properties();

		expect(properties).toHaveLength(2);
		const names = properties.map((p) => p.name);
		expect(names).toContain("name");
		expect(names).toContain("bio");
	});

	test("member reader is prepared like member first() is", () => {
		const Method = decorate.method<string>();

		class Service {
			@Method("endpoint")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			fetch(): void {}

			@Method("handler")
			// biome-ignore lint/suspicious/noEmptyBlockStatements: test stub method
			process(): void {}
		}

		// reader should prepare just like first/all, flushing deferred instance methods
		const readerMethods = Method.reader(Service).methods();
		expect(readerMethods).toHaveLength(2);
		const methodNames = readerMethods.map((m) => m.name);
		expect(methodNames).toContain("fetch");
		expect(methodNames).toContain("process");
	});
});
