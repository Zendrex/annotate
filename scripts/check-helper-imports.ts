#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN_PATTERNS = [
	/from\s+["']tslib["']/,
	/require\(\s*["']tslib["']\s*\)/,
	/from\s+["']@swc\/helpers/,
	/from\s+["']@babel\/runtime/,
];

const JS_FILE_RE = /\.(mjs|cjs|js)$/;

const DIST = join(import.meta.dir, "..", "dist");

function* walk(dir: string): Generator<string> {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		const s = statSync(full);
		if (s.isDirectory()) {
			yield* walk(full);
		} else if (s.isFile() && JS_FILE_RE.test(name)) {
			yield full;
		}
	}
}

const matches: string[] = [];
for (const file of walk(DIST)) {
	const src = readFileSync(file, "utf8");
	for (const re of FORBIDDEN_PATTERNS) {
		if (re.test(src)) {
			matches.push(`${file} matches ${re}`);
		}
	}
}

if (matches.length > 0) {
	// biome-ignore lint/suspicious/noConsole: CLI script
	console.error(`Forbidden helper-package import in dist/:\n${matches.join("\n")}`);
	// biome-ignore lint/suspicious/noConsole: CLI script
	console.error(
		"Annotate ships with inlined helpers. If the build now requires tslib / @swc/helpers / @babel/runtime, " +
			"declare it as a dependency or peerDependency before merging."
	);
	process.exit(1);
}
// biome-ignore lint/suspicious/noConsole: CLI script
console.log("dist/ helper-import guard: clean");
