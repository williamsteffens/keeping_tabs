type ShortcutEvent = Pick<
    KeyboardEvent,
    "code" | "key" | "ctrlKey" | "altKey" | "metaKey" | "shiftKey"
>;

export function recorded_shortcut(
    event: ShortcutEvent,
    is_mac: boolean,
): string | null {
    const modifiers: string[] = [];
    if (event.ctrlKey) modifiers.push(is_mac ? "MacCtrl" : "Ctrl");
    if (event.altKey) modifiers.push("Alt");
    if (event.metaKey) modifiers.push("Command");
    if (event.shiftKey) modifiers.push("Shift");

    const names: Record<string, string> = {
        " ": "Space",
        ",": "Comma",
        ".": "Period",
        ArrowUp: "Up",
        ArrowDown: "Down",
        ArrowLeft: "Left",
        ArrowRight: "Right",
    };
    let key = names[event.key] || event.key;
    // Physical letter/digit codes remain stable with Shift and Option held.
    if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
    if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(5);
    if (event.code === "Comma") key = "Comma";
    if (event.code === "Period") key = "Period";

    const function_key = /^F([1-9]|1[0-9])$/.test(key);
    const supported =
        /^[A-Z0-9]$/.test(key)
        || function_key
        || [
            "Comma",
            "Period",
            "Home",
            "End",
            "PageUp",
            "PageDown",
            "Space",
            "Insert",
            "Delete",
            "Up",
            "Down",
            "Left",
            "Right",
        ].includes(key);
    const primary_modifier = event.ctrlKey || event.altKey || event.metaKey;

    if (
        !supported
        || modifiers.length > 2
        || (!primary_modifier && !function_key)
        || (event.metaKey && !is_mac)
    ) {
        return null;
    }

    return [
        ...modifiers,
        key,
    ].join("+");
}
