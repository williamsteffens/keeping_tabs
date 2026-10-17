import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const manifest_path = fileURLToPath(new URL("manifest.json", import.meta.url));

export default defineConfig({
    base: "./",
    publicDir: false,
    plugins: [{
        name: "extension-manifest",
        buildStart() {
            this.addWatchFile(manifest_path);
        },
        generateBundle() {
            this.emitFile({
                type: "asset",
                fileName: "manifest.json",
                source: readFileSync(manifest_path, "utf8")
            });
        }
    }],
    build: {
        target: "firefox115",
        outDir: "dist",
        emptyOutDir: true,
        rolldownOptions: {
            input: {
                manager: "ui/manager.html",
                "core/background/background": "core/background/background.ts"
            },
            output: {
                // The manifest needs a stable path to the background entry.
                entryFileNames: "[name].js"
            }
        }
    }
});
