import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const source_path = (path: string) => {
    return fileURLToPath(new URL(`src/${path}`, import.meta.url));
};
const manifest_path = source_path("manifest.json");

export default defineConfig({
    root: source_path(""),
    base: "./",
    publicDir: false,
    plugins: [
        {
            name: "extension-manifest",
            buildStart() {
                this.addWatchFile(manifest_path);
            },
            generateBundle() {
                this.emitFile({
                    type: "asset",
                    fileName: "manifest.json",
                    source: readFileSync(manifest_path, "utf8"),
                });
            },
        },
    ],
    build: {
        target: "firefox115",
        outDir: "../dist",
        emptyOutDir: true,
        rolldownOptions: {
            input: {
                manager: source_path("ui/manager.html"),
                "core/background/background": source_path(
                    "core/background/background.ts",
                ),
            },
            output: {
                // The manifest needs a stable path to the background entry.
                entryFileNames: "[name].js",
            },
        },
    },
});
