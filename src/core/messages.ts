import type { ManagedTab, Settings } from "./types.ts";

interface MessageMap {
    getState: {
        request: { action: "getState" };
        response: { tabs: ManagedTab[]; settings: Settings };
    };
    unloadAll: {
        request: { action: "unloadAll" };
        response: { discarded: number };
    };
    unloadSelected: {
        request: { action: "unloadSelected"; tabIds: number[] };
        response: { discarded: number };
    };
    closeSelected: {
        request: { action: "closeSelected"; tabIds: number[] };
        response: { closed: number };
    };
    saveSettings: {
        request: { action: "saveSettings"; settings: Settings };
        response: { settings: Settings };
    };
}

type Action = keyof MessageMap;
type ManagerMessage = MessageMap[Action]["request"];

export function is_manager_message(value: unknown): value is ManagerMessage {
    if (!value || typeof value !== "object" || !("action" in value)) {
        return false;
    }

    switch (value.action) {
        case "getState":
        case "unloadAll":
            return true;
        case "unloadSelected":
        case "closeSelected":
            return "tabIds" in value && Array.isArray(value.tabIds)
                && value.tabIds.every(id => Number.isInteger(id));
        case "saveSettings": {
            if (!("settings" in value) || !value.settings
                || typeof value.settings !== "object") {
                return false;
            }
            const settings = value.settings;
            return "autoUnload" in settings
                && typeof settings.autoUnload === "boolean"
                && "inactivityMinutes" in settings
                && typeof settings.inactivityMinutes === "number"
                && (!("managerDisplay" in settings)
                    || settings.managerDisplay === "window"
                    || settings.managerDisplay === "overlay");
        }
        default:
            return false;
    }
}

export async function send_message<A extends Action>(
    message: MessageMap[A]["request"] & { action: A }
): Promise<MessageMap[A]["response"]> {
    return browser.runtime.sendMessage(message);
}
