import assert from "node:assert/strict";
import { test } from "node:test";
import { toggle_manager_overlay } from "../src/ui/overlay.ts";

test("overlay waits for its manager and cleans up after closing", async t => {
    const created: ElementStub[] = [];

    class ElementStub extends EventTarget {
        tag: string;
        children: ElementStub[] = [];
        shadowRoot: ElementStub | null = null;
        contentWindow = {};
        open = false;
        removed = false;
        focused = false;

        constructor(tag: string) {
            super();
            this.tag = tag;
        }

        append(...children: ElementStub[]) {
            this.children.push(...children);
        }
        setAttribute() {}
        attachShadow() {
            this.shadowRoot = new ElementStub("shadow");
            return this.shadowRoot;
        }
        showModal() { this.open = true; }
        focus() { this.focused = true; }
        remove() { this.removed = true; }
        close() {
            this.open = false;
            this.dispatchEvent(new Event("close"));
        }
    }

    const page_window = new EventTarget();
    const page_document = {
        getElementById: () => null,
        createElement: (tag: string) => {
            const element = new ElementStub(tag);
            created.push(element);
            return element;
        },
        documentElement: new ElementStub("html")
    };
    for (const [key, value] of [
        ["window", page_window], ["document", page_document]
    ] as const) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, value });
        t.after(() => {
            if (previous) Object.defineProperty(globalThis, key, previous);
            else Reflect.deleteProperty(globalThis, key);
        });
    }

    // Exercise the serialized function, as scripting.executeScript does.
    const injected = Function(`return (${toggle_manager_overlay.toString()})`)();
    const opening = injected("moz-extension://test/ui/manager.html?embedded=1");
    const dialog = created.find(element => element.tag === "dialog")!;
    const frame = created.find(element => element.tag === "iframe")!;
    assert.equal(dialog.open, false);
    assert.equal(frame.focused, false);

    function message(source: object, origin: string, data: string) {
        const event = new Event("message");
        Object.assign(event, { source, origin, data });
        page_window.dispatchEvent(event);
    }

    message({}, "moz-extension://test", "keeping-tabs-ready");
    message(frame.contentWindow, "https://example.com", "keeping-tabs-ready");
    await Promise.resolve();
    assert.equal(dialog.open, false);

    const origin = new URL("moz-extension://test/ui/manager.html").origin;
    message(frame.contentWindow, origin, "keeping-tabs-ready");
    await opening;
    assert.equal(dialog.open, true);
    assert.equal(frame.focused, true);

    message(frame.contentWindow, origin, "keeping-tabs-close");
    assert.equal(dialog.open, false);
    assert.equal(page_document.documentElement.children[0].removed, true);
});
