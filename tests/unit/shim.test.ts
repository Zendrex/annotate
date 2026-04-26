import { describe, expect, test } from "bun:test";

const HARNESS_PATH = new URL("../fixtures/shim-harness.ts", import.meta.url).pathname;

interface HarnessResult {
	defined: boolean;
	description: string | null;
	isRegistry: boolean;
}

async function runHarness(mode: "present" | "absent" | "idempotent"): Promise<HarnessResult> {
	const proc = Bun.spawn(["bun", HARNESS_PATH, mode], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	if (exitCode !== 0) {
		throw new Error(`shim harness ${mode} exited ${exitCode}: ${stderr}`);
	}
	return JSON.parse(stdout.trim()) as HarnessResult;
}

describe("Symbol.metadata shim", () => {
	test("installs the registry symbol when Symbol.metadata is absent", async () => {
		const result = await runHarness("absent");
		expect(result.defined).toBe(true);
		expect(result.isRegistry).toBe(true);
		expect(result.description).toBe("Symbol.metadata");
	});

	test("is idempotent when re-applied", async () => {
		const result = await runHarness("idempotent");
		expect(result.defined).toBe(true);
		expect(result.isRegistry).toBe(true);
	});
});
