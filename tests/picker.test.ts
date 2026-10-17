import assert from "node:assert/strict";
import { test } from "node:test";
import type { ManagedTab } from "../src/core/types.ts";
import { filter_tabs, order_tabs } from "../src/modules/tabs/picker.ts";
import { is_manager_message } from "../src/core/messages.ts";

const tabs: ManagedTab[] = [
    { id: 1, index: 1, windowId: 10, active: true,
        title: "Project notes", url: "https://example.com/docs",
        lastAccessed: 20 },
    { id: 2, index: 0, windowId: 10, active: false,
        title: "Project source", url: "https://github.com/example",
        lastAccessed: 30 },
    { id: 3, index: 0, windowId: 20, active: true,
        title: "Firefox settings", url: "about:preferences", lastAccessed: 10 },
    { id: 4, index: 1, windowId: 20, active: false, discarded: true,
        title: "Saved notes", url: "https://example.com/archive",
        lastAccessed: 40 }
].map(tab => ({ highlighted: false, pinned: false, incognito: false, ...tab }));
const ids = (items: ManagedTab[]) => items.map(tab => tab.id);

test("picker combines search, window, and activity filters", () => {
    assert.deepEqual(
        ids(filter_tabs(tabs, "PROJECT example", "all", 10)),
        [1, 2]
    );
    assert.deepEqual(
        ids(filter_tabs(tabs, "notes", "inactive", undefined)),
        [4]
    );
    assert.deepEqual(ids(filter_tabs(tabs, "", "active", undefined)), [1, 3]);
    assert.deepEqual(ids(filter_tabs(tabs, "", "inactive", undefined)), [2, 4]);
    assert.deepEqual(ids(filter_tabs(tabs, "", "unloaded", 20)), [4]);
    assert.deepEqual(ids(filter_tabs(tabs, "", "all", 999)), []);
    assert.deepEqual(
        ids(filter_tabs(tabs, "no matches", "all", undefined)),
        []
    );
    // Internal pages remain available for navigation.
    assert.deepEqual(
        ids(filter_tabs(tabs, "about:preferences", "all", 20)),
        [3]
    );
});

test("window groups prioritize the source and preserve tab order", () => {
    assert.deepEqual(ids(order_tabs(tabs, true, 20)), [3, 4, 2, 1]);
    assert.deepEqual(ids(order_tabs(tabs, true, 10)), [2, 1, 3, 4]);
    assert.deepEqual(ids(order_tabs(tabs, false, 10)), [4, 2, 1, 3]);
    assert.deepEqual(ids(tabs), [1, 2, 3, 4]);
});

test("tab activation requires an existing nonnegative integer ID", () => {
    for (const tabId of [1, 0]) {
        assert.equal(
            is_manager_message({ action: "activateTab", tabId }), true
        );
    }
    for (const tabId of [-1, 1.5, "1", null, undefined]) {
        assert.equal(
            is_manager_message({ action: "activateTab", tabId }), false
        );
    }
});
