import assert from "node:assert/strict";
import { test } from "node:test";
import { is_manager_message } from "../src/core/messages.ts";
import type { ManagedTab } from "../src/core/types.ts";
import {
    duplicate_groups, safe_default
} from "../src/modules/tabs/duplicates.ts";
import { escape_html } from "../src/ui/utils.ts";
import { render_tab_row } from "../src/ui/components/tab-row.ts";

function tab(id: number, overrides: Partial<ManagedTab> = {}): ManagedTab {
    return {
        id,
        index: id,
        windowId: 1,
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
        url: "https://example.com/?q=1",
        ...overrides
    };
}

test("tab rows avoid inaccessible browser-internal favicons", () => {
    const row = render_tab_row(tab(1, {
        favIconUrl: "chrome://mozapps/skin/extensions/extension.svg"
    }), "duplicate", false);
    assert.doesNotMatch(row, /chrome:\/\//);
    assert.doesNotMatch(row, /<img/);
    const web_icon = render_tab_row(tab(1, {
        favIconUrl: "https://example.com/icon.png"
    }), "duplicate", false);
    assert.match(web_icon, /<img/);
    assert.match(web_icon, /https:\/\/example.com\/icon.png/);
});

test("matching ignores fragments and retains query parameters", () => {
    const groups = duplicate_groups([
        tab(1, { url: "https://example.com/?q=1#a" }),
        tab(2, { url: "https://example.com/?q=1#b", windowId: 2 }),
        tab(3, { url: "https://example.com/?q=2" }),
        tab(4, { url: "data:text/plain,test" })
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].url, "https://example.com/?q=1");
    assert.deepEqual(groups[0].tabs.map(tab => tab.id), [1, 2]);
});

test("duplicate retention prioritizes active tabs, then pinned tabs", () => {
    const groups = duplicate_groups([
        tab(1), tab(2, { pinned: true }), tab(3, { active: true })
    ]);
    assert.deepEqual(groups[0].tabs.map(tab => tab.id), [3, 2, 1]);
    assert.equal(safe_default(tab(1)), true);
    assert.equal(safe_default(tab(2, { pinned: true })), false);
    assert.equal(safe_default(tab(3, { active: true })), false);
});

test("UI text escapes HTML and attribute delimiters", () => {
    assert.equal(
        escape_html('<script>"&\''),
        "&lt;script&gt;&quot;&amp;&#39;"
    );
});

test("message validation rejects malformed actions and tab IDs", () => {
    assert.equal(is_manager_message(null), false);
    assert.equal(is_manager_message({ action: "unknown" }), false);
    assert.equal(is_manager_message({ action: "getState" }), true);
    assert.equal(is_manager_message({
        action: "closeSelected", tabIds: [1, "2"]
    }), false);
    assert.equal(is_manager_message({
        action: "unloadSelected", tabIds: [1, 2]
    }), true);
    assert.equal(is_manager_message({
        action: "saveSettings", settings: { autoUnload: true }
    }), false);
    assert.equal(is_manager_message({
        action: "saveSettings",
        settings: { autoUnload: true, inactivityMinutes: 30 }
    }), true);
});

test("manager display accepts window and overlay while keeping old settings", () => {
    const settings = { autoUnload: true, inactivityMinutes: 30 };
    for (const managerDisplay of ["window", "overlay"]) {
        assert.equal(is_manager_message({
            action: "saveSettings",
            settings: { ...settings, managerDisplay }
        }), true);
    }
    assert.equal(is_manager_message({
        action: "saveSettings", settings
    }), true);
    assert.equal(is_manager_message({
        action: "saveSettings",
        settings: { ...settings, managerDisplay: "invalid" }
    }), false);
});
