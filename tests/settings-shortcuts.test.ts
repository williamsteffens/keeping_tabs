import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { setup_settings } from "../src/options/settings.ts";

test("settings reads and saves each registered shortcut independently", async t => {
    class ElementStub extends EventTarget {
        value = "";
        textContent = "";
        disabled = true;
    }
    const elements = new Map<string, ElementStub>();
    const bindings = new Map([
        ["command-palette", "Alt+Shift+K"], ["open-tabs", ""]
    ]);
    const manifest = JSON.parse(readFileSync(
        new URL("../src/manifest.json", import.meta.url), "utf8"
    ));
    for (const name of bindings.keys()) assert.ok(manifest.commands[name]);
    const saved: { name: string; shortcut: string }[] = [];
    const replacements = {
        document: {
            querySelector: (selector: string) => {
                if (!elements.has(selector)) {
                    elements.set(selector, new ElementStub());
                }
                return elements.get(selector);
            }
        },
        browser: {
            commands: {
                getAll: async () => [...bindings].map(([name, shortcut]) => ({
                    name, shortcut
                })),
                update: async (binding: { name: string; shortcut: string }) => {
                    saved.push(binding);
                    bindings.set(binding.name, binding.shortcut);
                }
            },
            runtime: { getPlatformInfo: async () => ({ os: "linux" }) }
        }
    };
    for (const [name, value] of Object.entries(replacements)) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { configurable: true, value });
        t.after(() => {
            if (previous) Object.defineProperty(globalThis, name, previous);
            else Reflect.deleteProperty(globalThis, name);
        });
    }
    setup_settings(() => {});
    const settle = () => new Promise(resolve => setImmediate(resolve));
    await settle();
    const manager = elements.get("#manager-shortcut")!;
    const picker = elements.get("#picker-shortcut")!;
    assert.equal(manager.value, "Alt+Shift+K");
    assert.equal(manager.disabled, false);
    assert.equal(picker.value, "");
    assert.equal(picker.disabled, false);

    const key = new Event("keydown", { cancelable: true });
    Object.assign(key, {
        key: "k", code: "KeyK", altKey: true, ctrlKey: false,
        metaKey: false, shiftKey: false
    });
    picker.dispatchEvent(key);
    assert.equal(picker.value, "Alt+K");
    elements.get("#picker-shortcut-form")!.dispatchEvent(
        new Event("submit", { cancelable: true })
    );
    await settle();
    assert.deepEqual(saved, [{ name: "open-tabs", shortcut: "Alt+K" }]);
    assert.equal(manager.value, "Alt+Shift+K");

    elements.get("#clear-shortcut")!.dispatchEvent(new Event("click"));
    elements.get("#shortcut-form")!.dispatchEvent(
        new Event("submit", { cancelable: true })
    );
    await settle();
    assert.deepEqual(saved.at(-1), { name: "command-palette", shortcut: "" });
    assert.equal(picker.value, "Alt+K");
});
