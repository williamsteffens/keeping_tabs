import type { ManagedTab } from "../../core/types.ts";

function normalize_url(raw: string) {
    try {
        const url = new URL(raw);
        url.hash = "";
        return url.href;
    } catch {
        return raw || "";
    }
}

export function duplicate_groups(all_tabs: ManagedTab[]) {
    const groups = new Map<string, ManagedTab[]>();
    const supported_url = /^https?:|^file:|^ftp:|^about:|^moz-extension:/i;

    for (const tab of all_tabs) {
        if (!tab.url || !supported_url.test(tab.url)) {
            continue;
        }

        const key = normalize_url(tab.url);
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)?.push(tab);
    }

    return [
        ...groups.entries(),
    ]
        .filter(([, tabs]) => tabs.length > 1)
        .map(([url, tabs]) => ({
            url,
            tabs: tabs.sort(
                (first, second) =>
                    Number(second.active) - Number(first.active)
                    || Number(second.pinned) - Number(first.pinned)
                    || first.index - second.index,
            ),
        }));
}

export function safe_default(tab: ManagedTab) {
    return !tab.active && !tab.pinned;
}
