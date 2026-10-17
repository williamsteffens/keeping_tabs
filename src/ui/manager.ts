import { send_message } from "../core/messages.ts";
import type { ManagedTab } from "../core/types.ts";
import { query_element as $ } from "./utils.ts";
import { DEFAULTS } from "../core/settings.ts";
import { duplicate_groups, safe_default } from "../modules/tabs/duplicates.ts";
import { render_settings, setup_settings } from "../options/settings.ts";
import { render_tab_row } from "./components/tab-row.ts";
import { display_url, escape_html, title_of } from "./utils.ts";

const overlay_error = new URLSearchParams(location.search).get("overlayError");
if (overlay_error) {
    const notice = document.createElement("div");
    notice.className = "notice";
    notice.setAttribute("role", "alert");
    notice.textContent = "The page overlay could not open. Firefox reported: "
        + overlay_error;
    document.body.prepend(notice);
}

if (window.parent !== window
    && new URLSearchParams(location.search).has("embedded")) {
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !event.defaultPrevented
            && !$<HTMLDialogElement>("#confirm-dialog").open) {
            window.parent.postMessage("keeping-tabs-close", "*");
        }
    });
}

let all_tabs: ManagedTab[] = [];
let selected_duplicate_ids = new Set<number>();
let selected_unload_ids = new Set<number>();
let pending_close_ids: number[] = [];
let toast_timer: ReturnType<typeof setTimeout> | undefined;

function show_toast(text: string) {
    const element = $("#toast");
    element.textContent = text;
    element.classList.add("show");
    clearTimeout(toast_timer);
    toast_timer = setTimeout(() => {
        element.classList.remove("show");
    }, 2600);
}

function preferred_tab(tabs: ManagedTab[]) {
    return tabs.find(tab => tab.active)
        || tabs.find(tab => tab.pinned)
        || tabs[0];
}

function render_duplicates() {
    const groups = duplicate_groups(all_tabs);
    const duplicate_copies = groups.reduce(
        (sum, group) => sum + group.tabs.length - 1, 0
    );
    const window_count = new Set(all_tabs.map(tab => tab.windowId)).size;
    $("#duplicate-count").textContent = String(duplicate_copies);
    $("#duplicate-summary").innerHTML = groups.length
        ? `<strong>${groups.length} duplicate groups</strong> · `
        + `${duplicate_copies} extra copies across ${window_count} windows.`
        : "<strong>No duplicate tabs found.</strong> Your open tabs have no "
        + "matching URLs under the current matching rules.";

    const root = $("#duplicate-list");
    if (!groups.length) {
        root.innerHTML = '<div class="empty">You’re all clear. Use '
            + '“Scan again” after opening more tabs.</div>';
        return;
    }

    root.innerHTML = groups.map(group => {
        const preferred = preferred_tab(group.tabs);
        if (!preferred) {
            return "";
        }
        const rows = group.tabs.map(tab => render_tab_row(
            tab, "duplicate", selected_duplicate_ids.has(tab.id)
        )).join("");

        return `<article class="group-card">
            <div class="group-header">
                <div>
                    <div class="group-title">${escape_html(title_of(preferred))
            }</div>
                    <div class="group-url">${escape_html(group.url)}</div>
                </div>
                <span class="group-meta">${group.tabs.length} copies</span>
            </div>
            ${rows}
        </article>`;
    }).join("");
}

function render_unload() {
    const loaded = all_tabs.filter(tab => !tab.discarded);
    const unloaded = all_tabs.filter(tab => tab.discarded);
    const eligible = loaded.filter(tab => !tab.active);
    $("#loaded-count").textContent = String(loaded.length);
    $("#unloaded-count").textContent = String(unloaded.length);
    $("#window-count").textContent = String(new Set(
        all_tabs.map(tab => tab.windowId)
    ).size);
    $("#unload-list").innerHTML = eligible.length
        ? eligible.map(tab => render_tab_row(
            tab, "unload", selected_unload_ids.has(tab.id)
        )).join("")
        : '<div class="empty">No eligible loaded tabs to unload.</div>';
}

function sync_selections() {
    selected_duplicate_ids = new Set([...selected_duplicate_ids].filter(id =>
        all_tabs.some(tab => tab.id === id)
    ));
    selected_unload_ids = new Set([...selected_unload_ids].filter(id =>
        all_tabs.some(tab => tab.id === id && !tab.active && !tab.discarded)
    ));
    $("#selected-count").textContent =
        `${selected_duplicate_ids.size} selected`;
    $<HTMLButtonElement>("#review-close").disabled =
        selected_duplicate_ids.size === 0;
    $("#unload-selected-count").textContent =
        `${selected_unload_ids.size} selected`;
    $<HTMLButtonElement>("#unload-selected").disabled =
        selected_unload_ids.size === 0;
}

async function refresh() {
    try {
        const state = await send_message({ action: "getState" });
        all_tabs = state.tabs || [];
        render_duplicates();
        render_unload();
        sync_selections();
        render_settings(state.settings || DEFAULTS);
    } catch (error) {
        show_toast("Could not load tabs. Try refreshing.");
        console.error(error);
    }
}

function set_view(view: string | undefined) {
    document.querySelectorAll<HTMLButtonElement>(".nav-tab").forEach(button => {
        button.classList.toggle("active", button.dataset.view === view);
    });
    document.querySelectorAll(".view").forEach(element => {
        element.classList.toggle("hidden", element.id !== `view-${view}`);
    });
}

document.querySelectorAll<HTMLButtonElement>(".nav-tab").forEach(button => {
    button.addEventListener("click", () => set_view(button.dataset.view));
});

$("#refresh").addEventListener("click", refresh);

$("#scan").addEventListener("click", async () => {
    selected_duplicate_ids.clear();
    await refresh();
    show_toast("Duplicate scan complete.");
});

document.addEventListener("change", event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
        return;
    }
    if (input.matches('input[data-kind="duplicate"]')) {
        const id = Number(input.dataset.id);
        if (input.checked) {
            selected_duplicate_ids.add(id);
        } else {
            selected_duplicate_ids.delete(id);
        }
        sync_selections();
    } else if (input.matches('input[data-kind="unload"]')) {
        const id = Number(input.dataset.id);
        if (input.checked) {
            selected_unload_ids.add(id);
        } else {
            selected_unload_ids.delete(id);
        }
        sync_selections();
    }
});

$<HTMLInputElement>("#select-removable").addEventListener("change", event => {
    selected_duplicate_ids.clear();
    if ((event.currentTarget as HTMLInputElement).checked) {
        for (const group of duplicate_groups(all_tabs)) {
            const keep = preferred_tab(group.tabs);
            for (const tab of group.tabs) {
                if (keep && tab.id !== keep.id && safe_default(tab)) {
                    selected_duplicate_ids.add(tab.id);
                }
            }
        }
    }
    render_duplicates();
    sync_selections();
});

$<HTMLInputElement>("#select-loaded").addEventListener("change", event => {
    selected_unload_ids.clear();
    if ((event.currentTarget as HTMLInputElement).checked) {
        for (const tab of all_tabs) {
            if (!tab.active && !tab.discarded) {
                selected_unload_ids.add(tab.id);
            }
        }
    }
    render_unload();
    sync_selections();
});

$<HTMLButtonElement>("#review-close").addEventListener("click", () => {
    const chosen = all_tabs.filter(tab => selected_duplicate_ids.has(tab.id));
    if (!chosen.length) {
        return;
    }

    pending_close_ids = chosen.map(tab => tab.id);
    const tab_label = `tab${chosen.length === 1 ? "" : "s"}`;
    $("#confirm-message").textContent =
        `You’re about to close ${chosen.length} ${tab_label}. `
        + "This cannot be undone by the extension.";
    $("#confirm-preview").innerHTML = chosen.map(tab =>
        `<div><strong>${escape_html(title_of(tab))}</strong><br>`
        + escape_html(display_url(tab.url))
        + `${tab.active ? " · ACTIVE" : ""}`
        + `${tab.pinned ? " · PINNED" : ""}</div>`
    ).join("");
    $("#confirm-close").textContent = `Close ${chosen.length} ${tab_label}`;
    $<HTMLDialogElement>("#confirm-dialog").showModal();
});

$<HTMLFormElement>("#confirm-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!(event.submitter instanceof HTMLButtonElement)
        || event.submitter.value !== "confirm") {
        $<HTMLDialogElement>("#confirm-dialog").close();
        return;
    }

    const ids = [...pending_close_ids];
    $<HTMLDialogElement>("#confirm-dialog").close();
    try {
        const result = await send_message({
            action: "closeSelected", tabIds: ids
        });
        selected_duplicate_ids.clear();
        $<HTMLInputElement>("#select-removable").checked = false;
        await refresh();
        show_toast(
            `Closed ${result.closed} tab${result.closed === 1 ? "" : "s"}.`
        );
    } catch (error) {
        console.error(error);
        show_toast("Some tabs could not be closed.");
    }
});

$<HTMLButtonElement>("#unload-all").addEventListener("click", async () => {
    const button = $<HTMLButtonElement>("#unload-all");
    button.disabled = true;
    try {
        const result = await send_message({
            action: "unloadAll"
        });
        await refresh();
        show_toast(
            `Unloaded ${result.discarded} `
            + `tab${result.discarded === 1 ? "" : "s"}.`
        );
    } catch {
        show_toast("Could not unload tabs.");
    } finally {
        button.disabled = false;
    }
});

$<HTMLButtonElement>("#unload-selected").addEventListener("click", async () => {
    const ids = [...selected_unload_ids];
    try {
        const result = await send_message({
            action: "unloadSelected", tabIds: ids
        });
        selected_unload_ids.clear();
        $<HTMLInputElement>("#select-loaded").checked = false;
        await refresh();
        show_toast(
            `Unloaded ${result.discarded} `
            + `tab${result.discarded === 1 ? "" : "s"}.`
        );
    } catch {
        show_toast("Could not unload selected tabs.");
    }
});

setup_settings(show_toast);
void refresh().then(() => {
    if (window.parent !== window
        && new URLSearchParams(location.search).has("embedded")) {
        window.parent.postMessage("keeping-tabs-ready", "*");
    }
});
