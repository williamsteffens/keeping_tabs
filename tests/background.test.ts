import assert from "node:assert/strict";
import { test } from "node:test";

test(
    "Alt+K opens the picker and switching focuses the tab’s window",
    async (t) => {
        function event() {
            return {
                listener: (..._args: any[]): any => {},
                addListener(listener: (...args: any[]) => any) {
                    this.listener = listener;
                },
            };
        }
        const on_command = event();
        const on_message = event();
        const on_click = event();
        const created: any[] = [];
        const scripts: any[] = [];
        const actions: unknown[] = [];
        let display = "window";
        const source = {
            id: 12,
            windowId: 7,
            active: true,
        };
        let current_tabs = [
            source,
        ];
        const previous = Object.getOwnPropertyDescriptor(globalThis, "browser");
        Object.defineProperty(globalThis, "browser", {
            configurable: true,
            value: {
                tabs: {
                    query: async () => current_tabs,
                    get: async (id: number) => {
                        if (id === 999) throw new Error("Tab closed");
                        return {
                            id,
                            windowId: 8,
                        };
                    },
                    update: async (id: number, options: object) => {
                        actions.push([
                            "tab",
                            id,
                            options,
                        ]);
                    },
                    onCreated: event(),
                    onRemoved: event(),
                    onActivated: event(),
                    onUpdated: event(),
                },
                sessions: {
                    getRecentlyClosed: async () => [
                        { tab: { sessionId: "closed-tab" } },
                        { window: { sessionId: "closed-window" } },
                    ],
                    restore: async (id: string) => {
                        if (id === "expired") throw new Error("Expired");
                        actions.push(["restore", id]);
                    },
                },
                windows: {
                    getLastFocused: async () => ({
                        left: 0,
                        top: 0,
                        width: 1200,
                        height: 900,
                    }),
                    create: async (options: object) => {
                        created.push(options);
                    },
                    update: async (id: number, options: object) => {
                        actions.push([
                            "window",
                            id,
                            options,
                        ]);
                    },
                },
                storage: {
                    local: { get: async () => ({ managerDisplay: display }) },
                    onChanged: event(),
                },
                alarms: {
                    clear: async () => {},
                    onAlarm: event(),
                },
                action: {
                    onClicked: on_click,
                    setBadgeText: async () => {},
                    setTitle: async () => {},
                },
                commands: { onCommand: on_command },
                scripting: {
                    executeScript: async (options: object) => {
                        scripts.push(options);
                    },
                },
                runtime: {
                    getURL: (path: string) => `moz-extension://test/${path}`,
                    onStartup: event(),
                    onInstalled: event(),
                    onMessage: on_message,
                },
            },
        });
        t.after(() => {
            if (previous)
                Object.defineProperty(globalThis, "browser", previous);
            else Reflect.deleteProperty(globalThis, "browser");
        });
        await import("../src/core/background/background.ts");
        const settle = () => new Promise((resolve) => setImmediate(resolve));
        await settle();
        on_command.listener("open-tabs", source);
        await settle();
        const url = new URL(created[0].url);
        assert.equal(url.searchParams.get("mode"), "tabs");
        assert.equal(url.searchParams.get("sourceWindow"), "7");
        on_click.listener(source);
        await settle();
        assert.equal(
            new URL(created[1].url).searchParams.get("mode"),
            "commands",
        );

        display = "overlay";
        on_command.listener("open-tabs", source);
        await settle();
        const overlay_url = new URL(scripts[0].args[0]);
        assert.equal(overlay_url.searchParams.get("embedded"), "1");
        assert.equal(overlay_url.searchParams.get("mode"), "tabs");
        assert.equal(created.length, 2);

        assert.deepEqual(
            await on_message.listener({
                action: "activateTab",
                tabId: 23,
            }),
            { activated: true },
        );
        assert.deepEqual(actions, [
            [
                "tab",
                23,
                { active: true },
            ],
            [
                "window",
                8,
                { focused: true },
            ],
        ]);
        actions.length = 0;
        await assert.rejects(
            on_message.listener({
                action: "activateTab",
                tabId: 999,
            }),
            /Tab closed/,
        );
        assert.deepEqual(actions, []);

        assert.deepEqual(
            await on_message.listener({ action: "getRecentlyClosed" }),
            { sessions: [
                { tab: { sessionId: "closed-tab" } },
                { window: { sessionId: "closed-window" } },
            ] },
        );
        for (const sessionId of ["closed-tab", "closed-window"]) {
            assert.deepEqual(
                await on_message.listener({
                    action: "restoreSession",
                    sessionId,
                }),
                { restored: true },
            );
        }
        assert.deepEqual(actions, [
            ["restore", "closed-tab"],
            ["restore", "closed-window"],
        ]);
        await assert.rejects(
            on_message.listener({
                action: "restoreSession",
                sessionId: "expired",
            }),
            /Expired/,
        );
        assert.equal(await on_message.listener({
            action: "restoreSession",
            sessionId: "",
        }), undefined);

        // Firefox 115–125 does not supply the second onCommand argument.
        display = "window";
        on_command.listener("open-tabs");
        await settle();
        const legacy_url = new URL(created[2].url);
        assert.equal(legacy_url.searchParams.get("mode"), "tabs");
        assert.equal(legacy_url.searchParams.get("sourceWindow"), "7");
        on_command.listener("command-palette");
        await settle();
        assert.equal(
            new URL(created[3].url).searchParams.get("mode"),
            "commands",
        );

        // A focused window without an active tab still permits the popup.
        current_tabs = [];
        display = "overlay";
        on_command.listener("open-tabs");
        await settle();
        assert.equal(new URL(created[4].url).searchParams.get("mode"), "tabs");
        on_command.listener("unrelated-command");
        await settle();
        assert.equal(created.length, 5);
    },
);
