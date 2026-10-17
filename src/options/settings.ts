import { send_message } from "../core/messages.ts";
import type { Settings } from "../core/types.ts";
import { query_element as $ } from "../ui/utils.ts";

export function render_settings(settings: Settings) {
    $<HTMLInputElement>("#auto-unload").checked = Boolean(settings.autoUnload);
    $<HTMLInputElement>("#inactivity-minutes").value = String(
        settings.inactivityMinutes || 30
    );
}

export function setup_settings(show_toast: (text: string) => void) {
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
                    inactivityMinutes: minutes
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
