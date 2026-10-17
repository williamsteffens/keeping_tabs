import assert from "node:assert/strict";
import { test } from "node:test";
import { setup_tab_picker } from "../src/ui/tab-picker.ts";
import type { ManagedTab } from "../src/core/types.ts";

test("picker selection follows groups and survives tab removal", async t => {
    class ElementStub extends EventTarget {
        value = "all";
        checked = false;
        innerHTML = "";
        textContent = "";
        attributes = new Map<string, string>();
        classList = { toggle() {} };
        get options() {
            return [...this.innerHTML.matchAll(/option value="([^"]+)"/g)]
                .map(match => ({ value: match[1] }));
        }
        setAttribute(key: string, value: string) {
            this.attributes.set(key, value);
        }
        removeAttribute(key: string) { this.attributes.delete(key); }
        scrollIntoView() {}
        focus() {}
    }
    const elements = new Map([
        "command-search", "picker-window", "picker-grouped", "command-list",
        "command-empty", "picker-status"
    ].map(id => [id, new ElementStub()]));
    const search = elements.get("command-search")!;
    search.value = "";
    const list = elements.get("command-list")!;
    const grouped = elements.get("picker-grouped")!;
    grouped.checked = true;
    let tabs: ManagedTab[] = [
        { id: 1, windowId: 10, index: 0, active: true,
            title: "First <script>", url: "https://one.example" },
        { id: 2, windowId: 20, index: 0, active: true,
            title: "Second", url: "about:config" },
        { id: 3, windowId: 20, index: 1, active: false, discarded: true,
            title: "Third", url: "https://three.example" }
    ].map(tab => ({ highlighted: false, pinned: false,
        incognito: false, ...tab }));
    const sent: unknown[] = [];
    let activated = 0;
    const notices: string[] = [];
    let fail = false;
    const replacements = {
        document: {
            querySelector: (selector: string) => elements.get(selector.slice(1)),
            querySelectorAll: () => [],
            getElementById: () => new ElementStub()
        },
        browser: {
            runtime: {
                sendMessage: async (message: unknown) => {
                    sent.push(message);
                    if (fail) throw new Error("Tab closed");
                    return { activated: true };
                }
            }
        }
    };
    for (const [key, value] of Object.entries(replacements)) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, value });
        t.after(() => {
            if (previous) Object.defineProperty(globalThis, key, previous);
            else Reflect.deleteProperty(globalThis, key);
        });
    }
    const picker = setup_tab_picker(
        () => tabs, 20, () => { activated++; }, text => notices.push(text)
    );
    picker.render();
    const selected = () => search.attributes.get("aria-activedescendant");
    assert.equal(selected(), "picker-tab-2");
    assert.match(list.innerHTML, /Current window/);
    assert.match(list.innerHTML, /Active/);
    assert.match(list.innerHTML, /Inactive/);
    assert.match(list.innerHTML, /Unloaded/);
    assert.match(list.innerHTML, /First &lt;script&gt;/);
    picker.move(1);
    assert.equal(selected(), "picker-tab-3");
    picker.move(1);
    assert.equal(selected(), "picker-tab-1");
    picker.move(1);
    assert.equal(selected(), "picker-tab-2");
    await picker.activate();
    assert.deepEqual(sent, [{ action: "activateTab", tabId: 2 }]);
    assert.equal(activated, 1);

    tabs = tabs.filter(tab => tab.id !== 2);
    picker.render();
    assert.equal(selected(), "picker-tab-3");
    elements.get("picker-window")!.value = "10";
    elements.get("picker-window")!.dispatchEvent(new Event("change"));
    assert.equal(selected(), "picker-tab-1");
    assert.doesNotMatch(list.innerHTML, /picker-tab-3/);
    search.value = "nothing matches";
    picker.render(true);
    assert.equal(selected(), undefined);
    await picker.activate();
    assert.equal(sent.length, 1);

    search.value = "first";
    picker.render(true);
    fail = true;
    const original_error = console.error;
    console.error = () => {};
    try { await picker.activate(); }
    finally { console.error = original_error; }
    assert.equal(activated, 1);
    assert.equal(notices.length, 1);
    assert.match(list.innerHTML, /aria-disabled="false"/);
});
