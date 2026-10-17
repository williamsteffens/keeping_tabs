import type { ManagedTab } from "../core/types.ts";

export function display_url(raw: string | undefined) {
    try {
        const url = new URL(raw ?? "");
        return url.host + url.pathname + url.search + url.hash;
    } catch {
        return raw || "URL unavailable";
    }
}

export function title_of(tab: ManagedTab) {
    return tab.title || display_url(tab.url) || "Untitled tab";
}

export function escape_html(text: unknown) {
    const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    };

    return String(text ?? "").replace(
        /[&<>"']/g, character => entities[character]
    );
}

export function query_element<T extends HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) {
        throw new Error(`Missing UI element: ${selector}`);
    }
    return element;
}
