import type { Settings } from "./types.ts";

export const DEFAULTS: Settings = {
    theme: "system",
    autoUnload: true,
    inactivityMinutes: 30,
    managerDisplay: "window",
};

export async function settings(): Promise<Settings> {
    return (await browser.storage.local.get(DEFAULTS)) as Settings;
}
