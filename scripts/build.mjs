import { cp, readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const manifest = JSON.parse(await readFile("manifest.json"))
if (process.argv[2] === "firefox") {
    manifest.browser_specific_settings = {
        "gecko": {
            "id": "twitterBookmarkDownloader@kotone.fami"
        }
    }
}
writeFile("dist/manifest.json", JSON.stringify(manifest))

await build({
    entryPoints: ["src/index.ts"],
    outdir: "dist",
    platform: "browser",
    format: "cjs",
    bundle: true,
    minify: true
});