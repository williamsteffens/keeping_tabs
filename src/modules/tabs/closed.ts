export interface ClosedEntry {
    session_id: string;
    kind: "tab" | "window";
    title: string;
    tabs: browser.tabs.Tab[];
}

export function closed_entries(sessions: browser.sessions.Session[]) {
    const entries: ClosedEntry[] = [];
    // Keep Firefox's newest-first order and restore windows as one entry.
    for (const session of sessions) {
        const item = session.window || session.tab;
        if (!item?.sessionId) continue;
        const tabs = session.window?.tabs || (session.tab ? [session.tab] : []);
        const kind = session.window ? "window" : "tab";
        entries.push({
            session_id: item.sessionId,
            kind,
            title: kind === "window"
                ? `Window · ${tabs.length} tab${tabs.length === 1 ? "" : "s"}`
                : tabs[0]?.title || tabs[0]?.url || "Untitled tab",
            tabs,
        });
    }
    return entries;
}

export function filter_closed(entries: ClosedEntry[], query: string) {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter((entry) => {
        const text = [
            entry.title,
            ...entry.tabs.map((tab) => `${tab.title || ""} ${tab.url || ""}`),
        ].join(" ").toLowerCase();
        return words.every((word) => text.includes(word));
    });
}
