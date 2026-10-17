import type { ManagedTab } from "../../core/types.ts";
import { display_url, escape_html, title_of } from "../utils.ts";

export function render_tab_row(
    tab: ManagedTab,
    kind: "duplicate" | "unload",
    checked: boolean
) {
    const tags = [
        tab.active ? '<span class="tag safe">Active</span>' : "",
        tab.pinned ? '<span class="tag">Pinned</span>' : "",
        tab.discarded ? '<span class="tag">Unloaded</span>' : ""
    ].filter(Boolean).join(" ");
    const disabled = kind === "unload" && (tab.active || tab.discarded);
    // Browser-internal favicon URLs cannot be loaded by extension pages.
    const accessible_icon = /^(https?:|data:image\/)/i.test(
        tab.favIconUrl || ""
    );
    const icon = accessible_icon
        ? `<img class="favicon" src="${escape_html(tab.favIconUrl)}" alt="">`
        : '<span class="favicon">🌐</span>';

    return `<label class="tab-row">
        <input type="checkbox" data-kind="${kind}" data-id="${tab.id}"
            ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
        ${icon}
        <span class="tab-info">
            <span class="tab-title">${escape_html(title_of(tab))}</span>
            <span class="tab-subtitle">Window ${tab.windowId} · ${
                escape_html(display_url(tab.url))
            }</span>
        </span>
        ${tags}
    </label>`;
}
