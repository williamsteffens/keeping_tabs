import assert from "node:assert/strict";
import { test } from "node:test";
import { setup_closed_picker } from "../src/ui/closed-picker.ts";

test("closed picker searches, previews, restores, and recovers", async (t) => {
    class ElementStub extends EventTarget {
        value = "";
        innerHTML = "";
        textContent = "";
        attributes = new Map<string, string>();
        classes = new Set<string>();
        classList = {
            toggle: (name: string, force: boolean) => {
                if (force) this.classes.add(name);
                else this.classes.delete(name);
            },
        };
        setAttribute(key: string, value: string) {
            this.attributes.set(key, value);
        }
        removeAttribute(key: string) {
            this.attributes.delete(key);
        }
        scrollIntoView() {}
    }
    const elements = new Map([
        "command-search", "command-list", "command-empty", "closed-preview",
        "toggle-closed-preview", "closed-preview-tabs",
    ].map((id) => [id, new ElementStub()]));
    const search = elements.get("command-search")!;
    const list = elements.get("command-list")!;
    let sessions = [
        { tab: { sessionId: "tab", title: "First <script>" } },
        { window: { sessionId: "window", tabs: [
            { title: "Notes <script>", url: "https://notes.example" },
        ] } },
    ];
    const restored: string[] = [];
    const notices: string[] = [];
    let fail_restore = false;
    let fail_load = false;
    let did_restore = 0;
    let resolve_pending: ((value: unknown) => void) | undefined;
    let pending = false;
    const replacements = {
        document: {
            querySelector: (selector: string) =>
                elements.get(selector.slice(1)),
            querySelectorAll: () => [],
            getElementById: () => new ElementStub(),
        },
        browser: { runtime: {
            sendMessage: async (message: {
                action: string; sessionId?: string;
            }) => {
                if (message.action === "getRecentlyClosed") {
                    if (pending) {
                        pending = false;
                        return new Promise((resolve) => {
                            resolve_pending = resolve;
                        });
                    }
                    if (fail_load) throw new Error("Unavailable");
                    return { sessions };
                }
                if (fail_restore) throw new Error("Expired");
                restored.push(message.sessionId!);
                sessions = sessions.filter((entry) =>
                    (entry.tab || entry.window)?.sessionId
                        !== message.sessionId,
                );
                return { restored: true };
            },
        } },
    };
    for (const [key, value] of Object.entries(replacements)) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, value });
        t.after(() => {
            if (previous) Object.defineProperty(globalThis, key, previous);
            else Reflect.deleteProperty(globalThis, key);
        });
    }
    const picker = setup_closed_picker(
        () => true,
        () => { did_restore++; },
        (text) => notices.push(text),
    );
    await picker.load();
    assert.match(list.innerHTML, /First &lt;script&gt;/);
    const selected = () => search.attributes.get("aria-activedescendant");
    assert.equal(selected(), "closed-entry-0");
    picker.move(1);
    assert.equal(selected(), "closed-entry-1");
    assert.equal(elements.get("closed-preview")!.classes.has("hidden"), false);
    elements.get("toggle-closed-preview")!.dispatchEvent(new Event("click"));
    assert.match(
        elements.get("closed-preview-tabs")!.innerHTML,
        /Notes &lt;script&gt;/,
    );
    await picker.activate();
    assert.deepEqual(restored, ["window"]);
    assert.equal(did_restore, 1);
    assert.doesNotMatch(list.innerHTML, /Restore window/);
    assert.equal(selected(), "closed-entry-0");
    search.value = "absent";
    picker.render(true);
    assert.equal(selected(), undefined);
    await picker.activate();
    assert.equal(restored.length, 1);
    search.value = "";
    picker.render(true);
    const original_error = console.error;
    console.error = () => {};
    t.after(() => { console.error = original_error; });
    fail_restore = true;
    await picker.activate();
    assert.equal(did_restore, 1);
    assert.match(notices.at(-1)!, /Could not restore/);
    assert.match(list.innerHTML, /aria-disabled="false"/);

    // An older response must not replace a newer list after onChanged.
    pending = true;
    const older = picker.load();
    sessions = [];
    await picker.load();
    resolve_pending!({ sessions: [{ tab: { sessionId: "stale" } }] });
    await older;
    assert.equal(list.innerHTML, "");
    assert.match(elements.get("command-empty")!.textContent, /No recently/);
    fail_load = true;
    await picker.load();
    assert.match(elements.get("command-empty")!.textContent, /Could not load/);
});
