import { is_manager_message } from "../messages.ts";
import { query_tabs } from "../tabs.ts";
import { settings } from "../settings.ts";
import { toggle_manager_overlay } from "../../ui/overlay.ts";
import {
    discard_tabs,
    last_active,
    unload_inactive
} from "../../modules/tabs/unload.ts";

const ALARM = "tab-manager-auto-unload";

async function refresh_alarm() {
    await browser.alarms.clear(ALARM);
    const current_settings = await settings();
    if (current_settings.autoUnload) {
        await browser.alarms.create(ALARM, { periodInMinutes: 1 });
    }
}

async function initialize() {
    const tabs = await query_tabs();
    const now = Date.now();
    for (const tab of tabs) {
        if (!last_active.has(tab.id)) {
            last_active.set(tab.id, now);
        }
    }

    await refresh_alarm();
    await update_badge();
}

async function update_badge() {
    try {
        const tabs = await query_tabs();
        const count = tabs.length;
        await browser.action.setBadgeText({ 
            text: count ? String(count) : "" 
        });

        await browser.action.setTitle({
            title: count
                ? `Open Tab Manager (${count} tabs)`
                : "Open Tab Manager"
        });
    } catch (error) {
        console.warn("Could not update badge", error);
    }
}

async function open_manager(
    source_tab: browser.tabs.Tab | undefined, mode = "commands"
) {
    // Firefox before 126 supplies only the command name to onCommand.
    const tab = source_tab || (await browser.tabs.query({
        active: true, currentWindow: true
    }))[0];
    const current_settings = await settings();
    const manager_url = new URL(browser.runtime.getURL("ui/manager.html"));
    manager_url.searchParams.set("mode", mode);
    if (tab?.windowId != null) {
        manager_url.searchParams.set("sourceWindow", String(tab.windowId));
    }
    let overlay_error = "";
    if (current_settings.managerDisplay === "overlay" && tab?.id != null) {
        try {
            const overlay_url = new URL(manager_url);
            overlay_url.searchParams.set("embedded", "1");
            await browser.scripting.executeScript({
                target: { tabId: tab.id },
                func: toggle_manager_overlay,
                args: [overlay_url.href]
            });
            return;
        } catch (error) {
            overlay_error = error instanceof Error
                ? error.message : String(error);
            console.warn("Page overlay unavailable; opening a window", error);
        }
    }

    const current = await browser.windows.getLastFocused();
    const width = 780;
    const height = 560;
    if (overlay_error) {
        manager_url.searchParams.set("overlayError", overlay_error);
    }
    const create_data: Parameters<typeof browser.windows.create>[0] = {
        url: manager_url.href,
        type: "popup",
        width,
        height,
        focused: true
    };

    // Best-effort centering over the currently focused browser window.
    if (current
        && typeof current.left === "number"
        && Number.isFinite(current.left)
        && typeof current.top === "number"
        && Number.isFinite(current.top)
        && typeof current.width === "number"
        && Number.isFinite(current.width)
        && typeof current.height === "number"
        && Number.isFinite(current.height)) {
        create_data.left = Math.max(
            0, Math.round(current.left + (current.width - width) / 2)
        );
        create_data.top = Math.max(
            0, Math.round(current.top + (current.height - height) / 2)
        );
    }

    try {
        await browser.windows.create(create_data);
    } catch {
        // Some platforms restrict placement; retry without coordinates.
        delete create_data.left;
        delete create_data.top;
        await browser.windows.create(create_data);
    }
}

browser.action.onClicked.addListener(tab => {
    void open_manager(tab).catch(console.error);
});
browser.commands.onCommand.addListener((command, tab) => {
    if (command === "open-tabs" || command === "command-palette") {
        const mode = command === "open-tabs" ? "tabs" : "commands";
        void open_manager(tab, mode).catch(console.error);
    }
});

browser.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM) {
        unload_inactive().then(update_badge).catch(console.error);
    }
});

browser.tabs.onActivated.addListener(({ tabId: tab_id }) => {
    last_active.set(tab_id, Date.now());
    update_badge();
});

browser.tabs.onCreated.addListener(tab => {
    if (tab.id != null) {
        last_active.set(tab.id, Date.now());
    }
});

browser.tabs.onRemoved.addListener(tab_id => last_active.delete(tab_id));

browser.tabs.onUpdated.addListener((tab_id, change_info) => {
    if (change_info.discarded === false) {
        last_active.set(tab_id, Date.now());
    }
    if ("discarded" in change_info) {
        update_badge();
    }
});

browser.storage.onChanged.addListener(() => refresh_alarm());
browser.runtime.onStartup.addListener(initialize);
browser.runtime.onInstalled.addListener(initialize);
initialize().catch(console.error);

// Message fields and stored settings retain their existing external names.
browser.runtime.onMessage.addListener(async (message: unknown) => {
    if (!is_manager_message(message)) {
        return undefined;
    }

    if (message.action === "unloadAll") {
        const tabs = await query_tabs();
        const discarded = await discard_tabs(tabs);
        await update_badge();
        return { discarded };
    }

    if (message.action === "unloadSelected") {
        const ids = new Set(message.tabIds || []);
        const tabs = await query_tabs();
        const discarded = await discard_tabs(tabs.filter(tab =>
            ids.has(tab.id)
        ));
        await update_badge();
        return { discarded };
    }

    if (message.action === "closeSelected") {
        const ids = [...new Set(message.tabIds || [])];
        const current_tabs = await query_tabs();
        const allowed = new Set(
            current_tabs.filter(tab => ids.includes(tab.id)).map(tab => tab.id)
        );
        const safe_ids = ids.filter(id => allowed.has(id));
        await browser.tabs.remove(safe_ids);
        for (const id of safe_ids) {
            last_active.delete(id);
        }
        await update_badge();
        return { closed: safe_ids.length };
    }

    if (message.action === "activateTab") {
        const tab = await browser.tabs.get(message.tabId);
        if (tab.windowId == null) throw new Error("Tab window is unavailable");
        await browser.tabs.update(message.tabId, { active: true });
        await browser.windows.update(tab.windowId, { focused: true });
        return { activated: true };
    }

    if (message.action === "getState") {
        const [tabs, current_settings] = await Promise.all([
            query_tabs(), settings()
        ]);
        return { tabs, settings: current_settings };
    }

    if (message.action === "saveSettings") {
        const next = {
            theme: message.settings.theme === "light"
                || message.settings.theme === "dark"
                ? message.settings.theme : "system" as const,
            managerDisplay: message.settings.managerDisplay === "overlay"
                ? "overlay" as const : "window" as const,
            autoUnload: Boolean(message.settings?.autoUnload),
            inactivityMinutes: Math.max(
                1,
                Math.min(
                    10080, Number(message.settings?.inactivityMinutes) || 30
                )
            )
        };
        await browser.storage.local.set(next);
        await refresh_alarm();
        return { settings: next };
    }

    return undefined;
});
