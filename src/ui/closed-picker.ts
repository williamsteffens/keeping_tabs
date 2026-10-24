import { send_message } from "../core/messages.ts";
import {
    closed_entries,
    filter_closed,
} from "../modules/tabs/closed.ts";
import type { ClosedEntry } from "../modules/tabs/closed.ts";
import {
    display_url,
    escape_html,
    query_element as $,
} from "./utils.ts";

export function setup_closed_picker(
    is_visible: () => boolean,
    on_restore: () => void,
    show_toast: (text: string) => void,
) {
    const search = $<HTMLInputElement>("#command-search");
    let entries: ClosedEntry[] = [];
    let visible: ClosedEntry[] = [];
    let selected_id: string | undefined;
    let loading = false;
    let failed = false;
    let busy = false;
    let expanded = false;
    let preview_id: string | undefined;
    let request_id = 0;

    function render(reset = false) {
        if (!is_visible()) return;
        visible = filter_closed(entries, search.value);
        if (reset || !visible.some((item) => item.session_id === selected_id)) {
            selected_id = visible[0]?.session_id;
        }
        $("#command-list").innerHTML = visible.map((entry, index) => {
            const description = entry.kind === "window"
                ? entry.tabs.map((tab) => tab.title || tab.url || "Untitled")
                    .join(" · ")
                : display_url(entry.tabs[0]?.url);
            return `<div id="closed-entry-${index}" role="option"
                class="command-row picker-row" data-closed-index="${index}"
                aria-selected="${entry.session_id === selected_id}"
                aria-disabled="${busy || loading}">
                <span class="command-icon" aria-hidden="true">${
                    entry.kind === "window" ? "▣" : "↶"
                }</span>
                <span class="command-copy">
                    <span class="command-title">${escape_html(
                        entry.title,
                    )}</span>
                    <span class="command-description">${escape_html(
                        description,
                    )}</span>
                </span>
                <span class="command-detail">Restore ${entry.kind}</span>
            </div>`;
        }).join("");
        $("#command-empty").classList.toggle("hidden", visible.length > 0);
        $("#command-empty").textContent = loading
            ? "Loading recently closed tabs and windows…"
            : failed
              ? "Could not load recently closed items. Reopen Closed to retry."
              : entries.length
                ? "No matching closed tabs or windows."
                : "No recently closed tabs or windows available in Firefox.";
        update_selection();
    }

    function update_selection() {
        const index = visible.findIndex(
            (entry) => entry.session_id === selected_id,
        );
        for (const row of document.querySelectorAll<HTMLElement>(
            "[data-closed-index]",
        )) {
            const active = Number(row.dataset.closedIndex) === index;
            row.classList.toggle("active", active);
            row.setAttribute("aria-selected", String(active));
        }
        if (index >= 0) {
            search.setAttribute(
                "aria-activedescendant",
                `closed-entry-${index}`,
            );
        } else {
            search.removeAttribute("aria-activedescendant");
        }
        const entry = visible[index];
        if (preview_id !== selected_id) expanded = false;
        preview_id = selected_id;
        $("#closed-preview").classList.toggle(
            "hidden",
            entry?.kind !== "window",
        );
        $("#toggle-closed-preview").setAttribute(
            "aria-expanded",
            String(expanded),
        );
        $("#closed-preview-tabs").classList.toggle("hidden", !expanded);
        $("#closed-preview-tabs").innerHTML = expanded
            ? (entry?.tabs || []).map((tab) => `<div class="closed-preview-tab">
                <strong>${escape_html(tab.title || "Untitled tab")}</strong>
                <div class="muted">${escape_html(display_url(tab.url))}</div>
            </div>`).join("")
            : "";
    }

    async function load() {
        const request = ++request_id;
        loading = true;
        failed = false;
        render();
        try {
            const result = await send_message({ action: "getRecentlyClosed" });
            if (request !== request_id) return;
            entries = closed_entries(result.sessions);
        } catch (error) {
            if (request !== request_id) return;
            console.error(error);
            entries = [];
            failed = true;
        } finally {
            if (request === request_id) {
                loading = false;
                render();
            }
        }
    }

    function move(delta: number) {
        if (!visible.length) return;
        const index = visible.findIndex(
            (entry) => entry.session_id === selected_id,
        );
        const next = (index + delta + visible.length) % visible.length;
        selected_id = visible[next].session_id;
        update_selection();
        document.getElementById(`closed-entry-${next}`)
            ?.scrollIntoView({ block: "nearest" });
    }

    async function activate(index?: number) {
        const entry = index == null
            ? visible.find((item) => item.session_id === selected_id)
            : visible[index];
        if (busy || loading || !entry) return;
        busy = true;
        render();
        try {
            await send_message({
                action: "restoreSession",
                sessionId: entry.session_id,
            });
            entries = entries.filter(
                (item) => item.session_id !== entry.session_id,
            );
            show_toast(`Restored ${entry.kind}.`);
            on_restore();
            await load();
        } catch (error) {
            console.error(error);
            show_toast("Could not restore this item. Refreshing the list…");
            await load();
        } finally {
            busy = false;
            render();
        }
    }

    $("#toggle-closed-preview").addEventListener("click", () => {
        expanded = !expanded;
        update_selection();
    });
    return { render, load, move, activate };
}
