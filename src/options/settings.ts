import { send_message } from "../core/messages.ts";
import type { Settings } from "../core/types.ts";
import { query_element as $ } from "../ui/utils.ts";
import { recorded_shortcut } from "./shortcut.ts";

export function render_settings(settings: Settings) {
    $<HTMLSelectElement>("#manager-display").value =
        settings.managerDisplay || "window";
    $<HTMLInputElement>("#auto-unload").checked = Boolean(settings.autoUnload);
    $<HTMLInputElement>("#inactivity-minutes").value = String(
        settings.inactivityMinutes || 30
    );
}

export function setup_settings(show_toast: (text: string) => void) {
    setup_shortcut();

    $("#save-settings").addEventListener("click", async () => {
        const input = $<HTMLInputElement>("#inactivity-minutes");
        const minutes = Math.max(
            1,
            Math.min(10080, Number(input.value) || 30)
        );
        $<HTMLInputElement>("#inactivity-minutes").value = String(minutes);

        try {
            const result = await send_message({
                action: "saveSettings",
                settings: {
                    autoUnload: $<HTMLInputElement>("#auto-unload").checked,
                    inactivityMinutes: minutes,
                    managerDisplay:
                        $<HTMLSelectElement>("#manager-display").value
                            === "overlay" ? "overlay" : "window"
                }
            });
            render_settings(result.settings);
            $("#settings-status").textContent = "Saved";
            setTimeout(() => {
                $("#settings-status").textContent = "";
            }, 1800);
            show_toast("Settings saved.");
        } catch {
            show_toast("Could not save settings.");
        }
    });
}

function setup_shortcut() {
    const input = $<HTMLInputElement>("#manager-shortcut");
    const button = $<HTMLButtonElement>("#save-shortcut");
    const status = $("#shortcut-status");
    const clear = $<HTMLButtonElement>("#clear-shortcut");
    let is_mac = false;

    input.addEventListener("keydown", event => {
        // Keep keyboard navigation available without recording it.
        if (event.key === "Tab") return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") {
            input.blur();
            return;
        }
        if (["Control", "Alt", "Meta", "Shift"].includes(event.key)) return;

        const shortcut = recorded_shortcut(event, is_mac);
        if (shortcut === null) {
            status.textContent = "Use Ctrl, Alt, or Command with a key, "
                + "and at most two modifiers.";
            return;
        }
        input.value = shortcut;
        status.textContent = "Recorded. Click Save shortcut to apply.";
    });

    clear.addEventListener("click", () => {
        input.value = "";
        status.textContent = "Click Save shortcut to disable it.";
    });

    async function load_shortcut() {
        try {
            // Read Firefox's binding, including changes from about:addons.
            const [commands, platform] = await Promise.all([
                browser.commands.getAll(), browser.runtime.getPlatformInfo()
            ]);
            is_mac = platform.os === "mac";
            const command = commands.find(item =>
                item.name === "_execute_action"
            );
            if (!command) {
                throw new Error("Manager shortcut is unavailable.");
            }
            input.value = command.shortcut || "";
            input.disabled = false;
            button.disabled = false;
            clear.disabled = false;
        } catch {
            status.textContent = "Could not load the shortcut. Reopen Settings.";
        }
    }

    $("#shortcut-form").addEventListener("submit", async event => {
        event.preventDefault();
        button.disabled = true;
        status.textContent = "";

        try {
            await browser.commands.update({
                name: "_execute_action",
                shortcut: input.value.trim()
            });
            await load_shortcut();
            status.textContent = input.value
                ? "Shortcut saved." : "Shortcut disabled.";
        } catch {
            status.textContent = "Could not set shortcut. Try Alt+Shift+K "
                + "or another valid combination.";
        } finally {
            button.disabled = false;
        }
    });

    void load_shortcut();
}
