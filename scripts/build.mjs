import { cp } from "node:fs/promises";
import { build } from "esbuild";

await cp("manifest.json", "dist/manifest.json");

await build({
    entryPoints: ["src/index.ts"],
    outdir: "dist",
    platform: "browser",
    format: "cjs",
    bundle: true,
    minify: true
});