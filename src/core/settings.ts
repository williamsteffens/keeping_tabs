import type { Settings } from "./types.ts";

export const DEFAULTS: Settings = { autoUnload: true, inactivityMinutes: 30 };

export async function settings(): Promise<Settings> {
    return await browser.storage.local.get(DEFAULTS) as Settings;
}
