import type { ManagedTab } from "../../core/types.ts";

export type TabStatus = "all" | "active" | "inactive" | "unloaded";

export function filter_tabs(
    tabs: ManagedTab[], query: string, status: TabStatus,
    window_id: number | undefined
) {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return tabs.filter(tab => {
        if (window_id != null && tab.windowId !== window_id) return false;
        if (status === "active" && !tab.active) return false;
        if (status === "inactive" && tab.active) return false;
        if (status === "unloaded" && !tab.discarded) return false;
        const text = `${tab.title || ""} ${tab.url || ""}`.toLowerCase();
        return words.every(word => text.includes(word));
    });
}

export function order_tabs(
    tabs: ManagedTab[], grouped: boolean, source_window: number | undefined
) {
    return [...tabs].sort((a, b) => {
        if (!grouped) return (b.lastAccessed || 0) - (a.lastAccessed || 0);
        const current = Number(b.windowId === source_window)
            - Number(a.windowId === source_window);
        return current || (a.windowId ?? -1) - (b.windowId ?? -1)
            || a.index - b.index;
    });
}
