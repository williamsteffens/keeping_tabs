import type { ManagedTab } from "./types.ts";

export async function query_tabs(
    query: Parameters<typeof browser.tabs.query>[0] = {},
): Promise<ManagedTab[]> {
    const tabs = await browser.tabs.query(query);
    return tabs.filter((tab): tab is ManagedTab => tab.id != null);
}
