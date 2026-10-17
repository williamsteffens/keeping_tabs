import assert from "node:assert/strict";
import { test } from "node:test";
import { setup_scrollbar } from "../src/ui/components/scrollbar.ts";

test("custom scrollbar tracks scrolling, dragging, and content changes", t => {
    const created: ElementStub[] = [];
    const observers: (() => void)[] = [];
    const frames: FrameRequestCallback[] = [];
    class ElementStub extends EventTarget {
        id = "content";
        className = "";
        classList = { add() {} };
        children: ElementStub[] = [];
        attributes = new Map<string, string>();
        style = { height: "", transform: "" };
        hidden = false;
        clientHeight = 200;
        scrollHeight = 1000;
        captured = new Set<number>();
        top = 0;
        get scrollTop() { return this.top; }
        set scrollTop(value: number) {
            this.top = Math.max(0, Math.min(
                this.scrollHeight - this.clientHeight, value
            ));
        }
        matches() { return false; }
        before() {}
        append(...children: ElementStub[]) {
            this.children.push(...children);
        }
        setAttribute(name: string, value: string) {
            this.attributes.set(name, value);
        }
        focus() {}
        getBoundingClientRect() { return { top: 0 }; }
        setPointerCapture(id: number) { this.captured.add(id); }
        hasPointerCapture(id: number) { return this.captured.has(id); }
        releasePointerCapture(id: number) { this.captured.delete(id); }
    }
    class ObserverStub {
        constructor(callback: () => void) { observers.push(callback); }
        observe() {}
    }
    const replacements = {
        document: {
            createElement: () => {
                const element = new ElementStub();
                created.push(element);
                return element;
            }
        },
        ResizeObserver: ObserverStub,
        MutationObserver: ObserverStub,
        requestAnimationFrame: (callback: FrameRequestCallback) => {
            frames.push(callback);
            return frames.length;
        }
    };
    for (const [name, value] of Object.entries(replacements)) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, {
            configurable: true, value
        });
        t.after(() => {
            if (previous) Object.defineProperty(globalThis, name, previous);
            else Reflect.deleteProperty(globalThis, name);
        });
    }
    function flush() {
        for (const frame of frames.splice(0)) frame(0);
    }
    function event(name: string, values: Record<string, unknown>) {
        const result = new Event(name, { cancelable: true });
        Object.assign(result, values);
        return result;
    }
    const viewport = new ElementStub();
    setup_scrollbar(viewport as unknown as HTMLElement);
    const track = created.find(item => item.className === "scroll-track")!;
    const thumb = created.find(item => item.className === "scroll-thumb")!;
    assert.equal(track.hidden, false);
    assert.equal(thumb.style.height, "40px");
    assert.equal(track.attributes.get("aria-controls"), "content");

    viewport.scrollTop = 400;
    viewport.dispatchEvent(new Event("scroll"));
    flush();
    assert.equal(thumb.style.transform, "translateY(80px)");
    assert.equal(track.attributes.get("aria-valuenow"), "400");

    for (const [key, expected] of [
        ["End", 800], ["Home", 0], ["ArrowDown", 40],
        ["PageDown", 220], ["PageUp", 40], ["ArrowUp", 0]
    ] as const) {
        track.dispatchEvent(event("keydown", { key }));
        assert.equal(viewport.scrollTop, expected);
    }

    // Clicking the middle of the track centers the thumb there.
    thumb.clientHeight = 40;
    track.dispatchEvent(event("pointerdown", {
        button: 0, pointerId: 1, clientY: 100
    }));
    assert.equal(viewport.scrollTop, 400);
    assert.equal(track.hasPointerCapture(1), true);
    track.dispatchEvent(event("pointermove", {
        pointerId: 1, clientY: 140
    }));
    assert.equal(viewport.scrollTop, 600);
    track.dispatchEvent(event("pointercancel", { pointerId: 1 }));
    track.dispatchEvent(event("pointermove", {
        pointerId: 1, clientY: 160
    }));
    assert.equal(viewport.scrollTop, 600);
    assert.equal(track.hasPointerCapture(1), false);

    track.dispatchEvent(event("wheel", { deltaY: 2, deltaMode: 1 }));
    assert.equal(viewport.scrollTop, 632);

    viewport.scrollHeight = 200;
    for (const observer of observers) observer();
    flush();
    assert.equal(track.hidden, true);
    viewport.scrollHeight = 2000;
    for (const observer of observers) observer();
    flush();
    assert.equal(track.hidden, false);
    assert.equal(thumb.style.height, "24px");
    assert.equal(track.attributes.get("aria-valuemax"), "1800");
});
