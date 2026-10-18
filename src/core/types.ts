export interface Settings {
    theme: "system" | "light" | "dark";
    autoUnload: boolean;
    inactivityMinutes: number;
    managerDisplay: "window" | "overlay";
}

// API tab IDs are optional; extension actions require an existing tab ID.
export type ManagedTab = browser.tabs.Tab & { id: number };
