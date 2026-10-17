import type { ManagedTab } from "../core/types.ts";
import { send_message } from "../core/messages.ts";
import { filter_tabs, order_tabs } from "../modules/tabs/picker.ts";
import type { TabStatus } from "../modules/tabs/picker.ts";
import { render_tab_icon } from "./components/tab-row.ts";
import { display_url, escape_html, title_of } from "./utils.ts";
import { query_element as $ } from "./utils.ts";

export function setup_tab_picker(
    get_tabs: () => ManagedTab[], source_window: number | undefined,
    on_activate: () => void, show_toast: (text: string) => void
) {
    const search = $<HTMLInputElement>("#command-search");
    const window_filter = $<HTMLSelectElement>("#picker-window");
    const grouped = $<HTMLInputElement>("#picker-grouped");
    let status: TabStatus = "all";
    let selected_id: number | undefined;
    let visible: ManagedTab[] = [];
    let busy = false;
    let window_key = "";

    function render(reset = false) {
        const tabs = get_tabs();
        const windows = [...new Set(tabs.map(tab => tab.windowId))];
        const key = windows.join(",");
        if (key !== window_key) {
            window_key = key;
            const previous = window_filter.value;
            window_filter.innerHTML = '<option value="all">All windows</option>'
                + (source_window != null
                    ? '<option value="current">Current window</option>' : "")
                + windows.map(id => `<option value="${id}">Window ${id}`
                    + '</option>').join("");
            window_filter.value = [...window_filter.options].some(option =>
                option.value === previous
            ) ? previous : "all";
        }
        const window_id = window_filter.value === "current" ? source_window
            : window_filter.value === "all" ? undefined
                : Number(window_filter.value);
        const scope = filter_tabs(tabs, "", "all", window_id);
        for (const button of document.querySelectorAll<HTMLButtonElement>(
            "[data-tab-status]"
        )) {
            const value = button.dataset.tabStatus as TabStatus;
            const count = filter_tabs(scope, "", value, undefined).length;
            button.setAttribute("aria-pressed", String(value === status));
            button.querySelector(".status-count")!.textContent = String(count);
        }
        visible = order_tabs(
            filter_tabs(tabs, search.value, status, window_id),
            grouped.checked, source_window
        );
        if (reset || !visible.some(tab => tab.id === selected_id)) {
            selected_id = visible[0]?.id;
        }
        const rows = (items: ManagedTab[]) => items.map(render_row).join("");
        if (grouped.checked) {
            const groups = new Map<number, ManagedTab[]>();
            for (const tab of visible) {
                const id = tab.windowId ?? -1;
                const group = groups.get(id) || [];
                group.push(tab);
                groups.set(id, group);
            }
            $("#command-list").innerHTML = [...groups].map(([id, items]) => {
                const label = `Window ${id}`
                    + (id === source_window ? " · Current window" : "");
                return `<div role="group" aria-label="${label}">
                    <div class="picker-window-heading">${label}
                        <span>${items.length} tabs</span>
                    </div>${rows(items)}</div>`;
            }).join("");
        } else {
            $("#command-list").innerHTML = rows(visible);
        }
        $("#command-empty").classList.toggle("hidden", visible.length > 0);
        $("#command-empty").textContent = tabs.length
            ? "No matching tabs. Try another search or filter."
            : "No tabs to show. Refresh open tabs to try again.";
        update_selection();
    }

    function render_row(tab: ManagedTab) {
        const state = tab.active ? "Active" : "Inactive";
        return `<div id="picker-tab-${tab.id}" role="option"
            class="command-row picker-row" data-tab-id="${tab.id}"
            aria-selected="${tab.id === selected_id}"
            aria-disabled="${busy}">
            ${render_tab_icon(tab)}
            <span class="command-copy">
                <span class="command-title">${escape_html(title_of(tab))}</span>
                <span class="command-description">${
                    escape_html(display_url(tab.url))
                }</span>
            </span>
            <span class="picker-badges">
                <span class="tag${tab.active ? " safe" : ""}"
                    title="${tab.active ? "Selected" : "Not selected"}
                        in its window">${state}</span>
                ${tab.discarded ? '<span class="tag">Unloaded</span>' : ""}
                ${tab.pinned ? '<span class="tag">Pinned</span>' : ""}
            </span>
        </div>`;
    }

    function update_selection() {
        for (const row of document.querySelectorAll<HTMLElement>(
            "[data-tab-id]"
        )) {
            const active = Number(row.dataset.tabId) === selected_id;
            row.classList.toggle("active", active);
            row.setAttribute("aria-selected", String(active));
        }
        if (selected_id != null) {
            search.setAttribute("aria-activedescendant",
                `picker-tab-${selected_id}`);
        } else {
            search.removeAttribute("aria-activedescendant");
        }
    }

    function move(delta: number) {
        if (!visible.length) return;
        const index = visible.findIndex(tab => tab.id === selected_id);
        selected_id = visible[(index + delta + visible.length)
            % visible.length].id;
        update_selection();
        document.getElementById(`picker-tab-${selected_id}`)
            ?.scrollIntoView({ block: "nearest" });
    }

    async function activate(id = selected_id) {
        if (busy || id == null || !visible.some(tab => tab.id === id)) return;
        busy = true;
        render();
        try {
            const result = await send_message({
                action: "activateTab", tabId: id
            });
            if (result.activated) on_activate();
        } catch (error) {
            console.error(error);
            show_toast("Could not switch tabs. The tab may have closed.");
        } finally {
            busy = false;
            render();
        }
    }

    $("#picker-status").addEventListener("click", event => {
        if (!(event.target instanceof Element)) return;
        const button = event.target.closest<HTMLElement>("[data-tab-status]");
        if (!button) return;
        status = button.dataset.tabStatus as TabStatus;
        render(true);
        search.focus();
    });
    window_filter.addEventListener("change", () => render(true));
    grouped.addEventListener("change", () => render(true));
    return { render, move, activate };
}
