import { describe, expect, test } from "bun:test";

import {
	AnnotateError,
	AnnotateErrorCode,
	DuplicateMetadataError,
	InvalidDecorationTargetError,
	MissingMetadataError,
	UnregisteredClassError,
	UnregisteredMetadataKeyError,
	ValidationError,
} from "../../src/errors";
import { mintUniqueKey } from "../../src/metadata/cardinality-registry";

const KEY = mintUniqueKey("test-key");

describe("UnregisteredClassError", () => {
	test("carries the offending class on .target and stable message shape", () => {
		class NotDecorated {}
		const err = new UnregisteredClassError(NotDecorated);
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("UnregisteredClassError");
		expect(err.target).toBe(NotDecorated);
		expect(err.message).toContain("NotDecorated");
	});
});

describe("MissingMetadataError", () => {
	test("class-level message and inherited fields", () => {
		class Subject {}
		const err = new MissingMetadataError({
			target: Subject,
			key: KEY,
			label: "Tag",
			kind: "class",
		});

		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(AnnotateError);
		expect(err).toBeInstanceOf(MissingMetadataError);
		expect(err.name).toBe("MissingMetadataError");
		expect(err.code).toBe(AnnotateErrorCode.MISSING);
		expect(err.key).toBe(KEY);
		expect(err.kind).toBe("class");
		expect(err.target).toBe(Subject);
		expect(err.memberName).toBeUndefined();
		expect(err.message).toBe('@Tag metadata missing on "Subject"');
	});

	test("member-level message qualifies the slot with class.member", () => {
		class Subject {}
		const err = new MissingMetadataError({
			target: Subject,
			key: KEY,
			label: "Column",
			kind: "property",
			memberName: "field",
		});

		expect(err.memberName).toBe("field");
		expect(err.message).toBe('@Column metadata missing on "Subject.field"');
	});

	test("symbol member name is stringified in the message", () => {
		class Subject {}
		const sym = Symbol("my-key");
		const err = new MissingMetadataError({
			target: Subject,
			key: KEY,
			label: "Column",
			kind: "property",
			memberName: sym,
		});

		expect(err.memberName).toBe(sym);
		expect(err.message).toContain("Symbol(my-key)");
		expect(err.message).toBe(`@Column metadata missing on "Subject.${String(sym)}"`);
	});
});

describe("InvalidDecorationTargetError", () => {
	test("populates inherited fields and retains requiredBase", () => {
		class Base {}
		class Subject {}
		const err = new InvalidDecorationTargetError({
			label: "Controller",
			target: Subject,
			requiredBase: Base,
			kind: "class",
			key: KEY,
		});

		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(AnnotateError);
		expect(err).toBeInstanceOf(InvalidDecorationTargetError);
		expect(err.name).toBe("InvalidDecorationTargetError");
		expect(err.code).toBe(AnnotateErrorCode.INVALID_TARGET);
		expect(err.key).toBe(KEY);
		expect(err.kind).toBe("class");
		expect(err.memberName).toBeUndefined();
		expect(err.target).toBe(Subject);
		expect(err.requiredBase).toBe(Base);
		expect(err.message).toBe("@Controller cannot decorate Subject: not a subclass of Base");
	});

	test("appends member name suffix when decorating a member", () => {
		class Base {}
		class Subject {}
		const err = new InvalidDecorationTargetError({
			label: "Route",
			target: Subject,
			requiredBase: Base,
			kind: "method",
			memberName: "handle",
			key: KEY,
		});

		expect(err.memberName).toBe("handle");
		expect(err.message).toBe("@Route cannot decorate Subject.handle: not a subclass of Base");
	});
});

describe("ValidationError", () => {
	test("populates inherited fields and formats class-level message", () => {
		class Subject {}
		const err = new ValidationError({
			label: "Schema",
			target: Subject,
			reason: "shape mismatch",
			kind: "class",
			key: KEY,
		});

		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(AnnotateError);
		expect(err).toBeInstanceOf(ValidationError);
		expect(err.name).toBe("ValidationError");
		expect(err.code).toBe(AnnotateErrorCode.VALIDATION);
		expect(err.key).toBe(KEY);
		expect(err.kind).toBe("class");
		expect(err.memberName).toBeUndefined();
		expect(err.target).toBe(Subject);
		expect(err.message).toBe("@Schema validation failed: shape mismatch");
	});

	test("qualifies message with class.member when memberName is provided", () => {
		class Subject {}
		const err = new ValidationError({
			label: "Schema",
			target: Subject,
			reason: "shape mismatch",
			kind: "property",
			memberName: "field",
			key: KEY,
		});

		expect(err.memberName).toBe("field");
		expect(err.message).toBe("@Schema validation failed on Subject.field: shape mismatch");
	});

	test("preserves cause by reference via native Error.cause", () => {
		class Subject {}
		const original = { reason: "bad shape" };
		const err = new ValidationError({
			label: "Schema",
			target: Subject,
			reason: "wrapped failure",
			kind: "class",
			key: KEY,
			cause: original,
		});

		expect(err.cause).toBe(original);
	});

	test("omits cause when none is provided", () => {
		class Subject {}
		const err = new ValidationError({
			label: "Schema",
			target: Subject,
			reason: "no cause",
			kind: "class",
			key: KEY,
		});

		expect(err.cause).toBeUndefined();
	});
});

describe("UnregisteredMetadataKeyError", () => {
	test("AnnotateError fields, key, and message reference the target", () => {
		class Widget {}
		const key = mintUniqueKey("widget-key");
		const err = new UnregisteredMetadataKeyError(Widget, key);

		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(AnnotateError);
		expect(err).toBeInstanceOf(UnregisteredMetadataKeyError);
		expect(err.name).toBe("UnregisteredMetadataKeyError");
		expect(err.code).toBe(AnnotateErrorCode.UNREGISTERED_KEY);
		expect(err.target).toBe(Widget);
		expect(err.key).toBe(key);
		expect(err.message.length).toBeGreaterThan(0);
		expect(err.message).toContain("Widget");
	});
});

describe("DuplicateMetadataError", () => {
	test("class-level message and inherited fields", () => {
		class Subject {}
		const err = new DuplicateMetadataError(Subject, KEY, "unique", "class");

		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(AnnotateError);
		expect(err).toBeInstanceOf(DuplicateMetadataError);
		expect(err.name).toBe("DuplicateMetadataError");
		expect(err.code).toBe(AnnotateErrorCode.DUPLICATE);
		expect(err.key).toBe(KEY);
		expect(err.kind).toBe("class");
		expect(err.target).toBe(Subject);
		expect(err.memberName).toBeUndefined();
		expect(err.message).toContain("Subject");
		expect(err.message).toContain("unique");
		expect(err.message).toContain("test-key");
	});

	test("member-level retains memberName and slot in message", () => {
		class Subject {}
		const err = new DuplicateMetadataError(Subject, KEY, "list", "property", "field");

		expect(err.memberName).toBe("field");
		expect(err.message).toContain("Subject.field");
		expect(err.message).toContain("list");
	});
});
