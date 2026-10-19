import assert from "node:assert/strict";
import { test } from "node:test";
import type { ManagedTab } from "../src/core/types.ts";
import {
    can_unload,
    discard_tabs,
    is_about_tab,
    last_active,
    unload_inactive,
} from "../src/modules/tabs/unload.ts";
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
        url: "https://example.com/",
        ...overrides,
    };
}

test(
    "unload eligibility excludes about pages, active and discarded tabs",
    () => {
        for (const url of [
            "about:config",
            "about:preferences#privacy",
            "about:addons",
            "about:newtab",
            "about:blank",
            "about:reader?url=https://example.com",
            "ABOUT:config",
        ]) {
            const candidate = tab(1, { url });
            assert.equal(is_about_tab(candidate), true);
            assert.equal(can_unload(candidate), false);
            assert.match(
                render_tab_row(candidate, "unload", false),
                /disabled/,
            );
        }
        assert.equal(can_unload(tab(1)), true);
        assert.equal(can_unload(tab(1, { pinned: true })), true);
        assert.equal(can_unload(tab(1, { active: true })), false);
        assert.equal(can_unload(tab(1, { discarded: true })), false);
        assert.equal(can_unload(tab(1, { url: undefined })), false);
        assert.equal(
            can_unload(
                tab(1, {
                    url: "https://example.com/about:config",
                }),
            ),
            true,
        );
    },
);

test(
    "manual and automatic unloads skip about pages and confirm results",
    async (t) => {
        const tabs = [
            tab(1, { url: "about:config" }),
            tab(2),
            tab(3),
            tab(4, { active: true }),
            tab(5, { discarded: true }),
        ];
        const attempted: number[] = [];
        const previous = Object.getOwnPropertyDescriptor(globalThis, "browser");
        Object.defineProperty(globalThis, "browser", {
            configurable: true,
            value: {
                tabs: {
                    query: async () => tabs,
                    discard: async (id: number) => {
                        attempted.push(id);
                    },
                    // Tab 3 models a silent refusal by Firefox.
                    get: async (id: number) => tab(id, { discarded: id === 2 }),
                },
                storage: {
                    local: {
                        get: async () => ({
                            autoUnload: true,
                            inactivityMinutes: 1,
                        }),
                    },
                },
            },
        });
        t.after(() => {
            last_active.clear();
            if (previous)
                Object.defineProperty(globalThis, "browser", previous);
            else Reflect.deleteProperty(globalThis, "browser");
        });
        assert.equal(await discard_tabs(tabs), 1);
        assert.deepEqual(
            attempted,
            [
                2,
                3,
            ],
        );

        attempted.length = 0;
        for (const candidate of tabs) {
            last_active.set(candidate.id, Date.now() - 120_000);
        }
        await unload_inactive();
        assert.deepEqual(
            attempted,
            [
                2,
                3,
            ],
        );
    },
);
