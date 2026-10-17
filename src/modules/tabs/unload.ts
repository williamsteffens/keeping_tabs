import { query_tabs } from "../../core/tabs.ts";
import type { ManagedTab } from "../../core/types.ts";
import { settings } from "../../core/settings.ts";

export function is_about_tab(tab: ManagedTab) {
    return /^about:/i.test(tab.url || "");
}

export function can_unload(tab: ManagedTab) {
    return tab.id != null && Boolean(tab.url) && !is_about_tab(tab)
        && !tab.active && !tab.discarded;
}

export const last_active = new Map<number, number>();

export async function discard_tabs(tabs: ManagedTab[]) {
    // Discard sequentially so one failure does not block the remaining tabs.
    let discarded = 0;
    for (const tab of tabs) {
        if (!can_unload(tab)) {
            continue;
        }

        try {
            await browser.tabs.discard(tab.id);
            // Firefox may resolve discard() without unloading the tab.
            const current = await browser.tabs.get(tab.id);
            if (current.discarded) discarded++;
        } catch (error) {
            console.debug(`Could not discard tab ${tab.id}`, error);
        }
    }

    return discarded;
}

export async function unload_inactive() {
    const current_settings = await settings();
    if (!current_settings.autoUnload) {
        return;
    }

    const threshold = Math.max(
        1, Number(current_settings.inactivityMinutes) || 30
    ) * 60_000;
    const now = Date.now();
    const tabs = await query_tabs();
    const candidates = [];

    for (const tab of tabs) {
        if (!can_unload(tab)) {
            continue;
        }

        // Start tracking newly discovered tabs before considering them idle.
        if (!last_active.has(tab.id)) {
            last_active.set(tab.id, now);
            continue;
        }

        if (now - (last_active.get(tab.id) ?? now) >= threshold) {
            candidates.push(tab);
        }
    }

    await discard_tabs(candidates);
}
