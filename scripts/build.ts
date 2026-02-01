import type { BuildConfig } from "bun";

import dts from "bun-plugin-dts";

const defaultConfig: BuildConfig = {
	entrypoints: ["src/index.ts"],
	outdir: "dist",
	external: ["reflect-metadata"],
};

await Promise.all([
	Bun.build({
		...defaultConfig,
		format: "esm",
		plugins: [
			dts({
				output: {
					noBanner: true,
				},
			}),
		],
		naming: "[dir]/[name].js",
	}),
	Bun.build({
		...defaultConfig,
		format: "cjs",
		naming: "[dir]/[name].cjs",
	}),
]);
