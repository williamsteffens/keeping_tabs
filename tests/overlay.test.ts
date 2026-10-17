import assert from "node:assert/strict";
import { test } from "node:test";
import { toggle_manager_overlay } from "../src/ui/overlay.ts";

test("overlay waits for its manager and cleans up after closing", async t => {
    const created: ElementStub[] = [];
    const styles = new Map([["overflow", ["scroll", "important"]]]);
    let fail_modal = false;

    class KeyboardStub extends Event {
        key: string;
        constructor(key: string) {
            super("keydown", { cancelable: true });
            this.key = key;
        }
    }

    class ElementStub extends EventTarget {
        tag: string;
        children: ElementStub[] = [];
        shadowRoot: ElementStub | null = null;
        contentWindow = {};
        open = false;
        removed = false;
        focused = false;
        style = {
            height: "",
            getPropertyValue: (name: string) => styles.get(name)?.[0] || "",
            getPropertyPriority: (name: string) => styles.get(name)?.[1] || "",
            setProperty: (name: string, value: string, priority = "") => {
                styles.set(name, [value, priority]);
            },
            removeProperty: (name: string) => { styles.delete(name); }
        };

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
        showModal() {
            if (fail_modal) throw new Error("Could not show modal");
            this.open = true;
        }
        focus() { this.focused = true; }
        remove() { this.removed = true; }
        close() {
            this.open = false;
            this.dispatchEvent(new Event("close"));
        }
    }

    const page_window = new EventTarget();
    const previous_focus = new ElementStub("input");
    const page_document = {
        activeElement: previous_focus,
        getElementById: () => null,
        createElement: (tag: string) => {
            const element = new ElementStub(tag);
            created.push(element);
            return element;
        },
        documentElement: new ElementStub("html")
    };
    for (const [key, value] of [
        ["window", page_window], ["document", page_document],
        ["KeyboardEvent", KeyboardStub]
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

    function message(source: object, origin: string, data: unknown) {
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
    assert.deepEqual(styles.get("overflow"), ["hidden", "important"]);

    let received = 0;
    const page_listener = () => { received++; };
    const event_types = ["wheel", "pointerdown", "paste", "keydown"];
    for (const type of event_types) {
        page_window.addEventListener(type, page_listener);
        const event = type === "keydown" ? new KeyboardStub("a")
            : new Event(type, { cancelable: true });
        page_window.dispatchEvent(event);
        assert.equal(event.defaultPrevented, true);
    }
    assert.equal(received, 0);

    const expanded = { type: "keeping-tabs-view", expanded: true };
    message({}, origin, expanded);
    message(frame.contentWindow, "https://example.com", expanded);
    assert.equal(frame.style.height, "");
    message(frame.contentWindow, origin, expanded);
    assert.equal(frame.style.height, "100%");
    message(frame.contentWindow, origin, {
        type: "keeping-tabs-view", expanded: false
    });
    assert.equal(frame.style.height, "min(470px, 100%)");

    message(frame.contentWindow, origin, "keeping-tabs-close");
    assert.equal(dialog.open, false);
    assert.equal(page_document.documentElement.children[0].removed, true);
    assert.deepEqual(styles.get("overflow"), ["scroll", "important"]);
    assert.equal(previous_focus.focused, true);
    for (const type of event_types) {
        const event = type === "keydown" ? new KeyboardStub("a")
            : new Event(type, { cancelable: true });
        page_window.dispatchEvent(event);
        assert.equal(event.defaultPrevented, false);
        page_window.removeEventListener(type, page_listener);
    }
    assert.equal(received, event_types.length);

    // Failure after locking must restore the page as well.
    fail_modal = true;
    styles.delete("overflow");
    const failed = injected("moz-extension://test/ui/manager.html?embedded=1");
    const last_frame = created.filter(item => item.tag === "iframe").at(-1)!;
    message(last_frame.contentWindow, origin, "keeping-tabs-ready");
    await assert.rejects(failed, /Could not show modal/);
    assert.equal(styles.has("overflow"), false);
    const wheel = new Event("wheel", { cancelable: true });
    page_window.dispatchEvent(wheel);
    assert.equal(wheel.defaultPrevented, false);

    fail_modal = false;
    async function reopen() {
        const opening = injected(
            "moz-extension://test/ui/manager.html?embedded=1"
        );
        const frame = created.filter(item => item.tag === "iframe").at(-1)!;
        message(frame.contentWindow, origin, "keeping-tabs-ready");
        await opening;
        return created.filter(item => item.tag === "dialog").at(-1)!;
    }

    const reopened = await reopen();
    const close = created.filter(item => item.tag === "button").at(-1)!;
    const tab = new KeyboardStub("Tab");
    // Include the shadow host, as a real composed event does.
    const last_host = created.filter(item => item.tag === "div").at(-1)!;
    Object.defineProperty(tab, "composedPath", {
        value: () => [close, reopened, last_host], configurable: true
    });
    page_window.dispatchEvent(tab);
    assert.equal(tab.defaultPrevented, false);
    assert.equal(reopened.open, true);

    const click = new Event("click", { cancelable: true });
    Object.defineProperty(click, "composedPath", {
        value: () => [close, reopened, last_host]
    });
    page_window.dispatchEvent(click);
    assert.equal(reopened.open, false);
    assert.equal(click.defaultPrevented, true);

    const escaped = await reopen();
    page_window.dispatchEvent(new KeyboardStub("Escape"));
    assert.equal(escaped.open, false);
    assert.equal(styles.has("overflow"), false);
});
