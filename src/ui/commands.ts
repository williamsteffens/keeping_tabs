export const COMMANDS = [
    {
        id: "tabs",
        title: "Search open tabs",
        description: "Switch tabs, filter by activity, or group by window",
        keywords: "find navigate active inactive windows picker",
        icon: "⌕",
        detail: "Alt+K",
    },
    {
        id: "duplicates",
        title: "Review duplicate tabs",
        description: "Choose which copies to close across your windows",
        keywords: "close remove clean copies urls",
        icon: "⧉",
        detail: "Review…",
    },
    {
        id: "unload-all",
        title: "Unload all inactive tabs",
        description: "Free memory and keep tabs available to reopen",
        keywords: "discard suspend memory all",
        icon: "↓",
        detail: "Run",
    },
    {
        id: "unload",
        title: "Choose tabs to unload",
        description: "Select individual tabs to free up memory",
        keywords: "discard suspend select memory",
        icon: "☷",
        detail: "Select…",
    },
    {
        id: "settings",
        title: "Settings",
        description: "Automatic unloading, manager display, and shortcuts",
        keywords: "preferences configure keyboard overlay window",
        detail: "Open…",
    },
    {
        id: "refresh",
        title: "Refresh open tabs",
        description: "Update tab counts and scan for duplicates again",
        keywords: "reload rescan sync scan",
        icon: "↻",
        detail: "Run",
    },
] as const;

export type CommandId = (typeof COMMANDS)[number]["id"];

export function matching_commands(query: string) {
    const words = query
        .trim()
        .replace(/^>\s*/, "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    return COMMANDS.filter((command) => {
        const text =
            `${command.title} ${command.description} ` + command.keywords;
        return words.every((word) => text.toLowerCase().includes(word));
    });
}
