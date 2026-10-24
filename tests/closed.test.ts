import assert from "node:assert/strict";
import { test } from "node:test";
import { is_manager_message } from "../src/core/messages.ts";
import {
    closed_entries,
    filter_closed,
} from "../src/modules/tabs/closed.ts";

export const sessions = [
    {
        lastModified: 30,
        tab: {
            sessionId: "tab-1",
            title: "First <script>",
            url: "https://first.example",
        },
    },
    {
        lastModified: 20,
        window: {
            sessionId: "window-1",
            tabs: [
                { title: "Work", url: "https://work.example" },
                { title: "Notes", url: "https://notes.example" },
            ],
        },
    },
    { lastModified: 10, tab: { title: "Not restorable" } },
] as browser.sessions.Session[];

test("closed list preserves order and keeps windows together", () => {
    const entries = closed_entries(sessions);
    assert.deepEqual(entries.map((item) => item.session_id), [
        "tab-1", "window-1",
    ]);
    assert.equal(entries[1].title, "Window · 2 tabs");
    assert.equal(entries[1].tabs.length, 2);
    assert.deepEqual(filter_closed(entries, " WORK notes.example "), [
        entries[1],
    ]);
    assert.deepEqual(filter_closed(entries, "FIRST"), [entries[0]]);
    assert.deepEqual(filter_closed(entries, "missing"), []);
    assert.equal(filter_closed(entries, " ").length, 2);
});

test("session restoration requires an explicit nonempty ID", () => {
    for (const sessionId of [undefined, null, 123, "", "   "]) {
        assert.equal(is_manager_message({
            action: "restoreSession", sessionId,
        }), false);
    }
    assert.equal(is_manager_message({
        action: "restoreSession", sessionId: "window-1",
    }), true);
    assert.equal(is_manager_message({ action: "getRecentlyClosed" }), true);
});
