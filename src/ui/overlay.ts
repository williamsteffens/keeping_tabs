// This function is serialized into the active tab; keep it self-contained.
export async function toggle_manager_overlay(manager_url: string) {
    const host_id = "keeping-tabs-manager-overlay";
    const existing = document.getElementById(host_id);
    if (existing) {
        existing.shadowRoot?.querySelector("dialog")?.close();
        return;
    }

    const host = document.createElement("div");
    host.id = host_id;
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
        :host { all: initial; }
        dialog {
            position: fixed;
            inset: 0;
            box-sizing: border-box;
            width: 100vw;
            height: 100vh;
            max-width: none;
            max-height: none;
            margin: 0;
            padding: 40px 24px 24px;
            border: 0;
            background: transparent;
            overflow: hidden;
        }
        dialog[open] { display: flex; justify-content: center; }
        dialog::backdrop {
            background: rgb(10 15 25 / 45%);
            backdrop-filter: blur(9px);
        }
        iframe {
            width: min(1100px, 100%);
            height: 100%;
            border: 0;
            border-radius: 16px;
            background: #121821;
            box-shadow: 0 24px 80px rgb(0 0 0 / 45%);
        }
        button {
            position: absolute;
            right: 24px;
            top: 6px;
            border: 0;
            border-radius: 6px;
            padding: 5px 12px;
            background: #202936;
            color: white;
            font: 14px system-ui;
            cursor: pointer;
        }
    `;
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-label", "Keeping Tabs manager");
    const frame = document.createElement("iframe");
    frame.src = manager_url;
    frame.title = "Keeping Tabs manager";
    const close = document.createElement("button");
    close.textContent = "Close ×";
    close.type = "button";
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
    });

    let ready_timer: ReturnType<typeof setTimeout> | undefined;
    let mark_ready: () => void = () => {};
    const ready = new Promise<void>((resolve, reject) => {
        mark_ready = resolve;
        ready_timer = setTimeout(() => {
            reject(new Error("The manager did not finish loading."));
        }, 10000);
    });

    const on_message = (event: MessageEvent) => {
        if (event.source === frame.contentWindow
            && event.origin === new URL(manager_url).origin) {
            if (event.data === "keeping-tabs-ready") mark_ready();
            if (event.data === "keeping-tabs-close") dialog.close();
        }
    };

    const cleanup = () => {
        window.removeEventListener("message", on_message);
        host.remove();
    };
    dialog.addEventListener("close", () => {
        cleanup();
    }, { once: true });
    dialog.append(close, frame);
    shadow.append(style, dialog);
    window.addEventListener("message", on_message);
    document.documentElement.append(host);

    try {
        // Load the frame while the dialog is hidden. Reveal the complete UI
        // only after its styles, scripts, and initial tab data are ready.
        await ready;
        // Modal dialogs enter the top layer, above high-z-index page UI.
        dialog.showModal();
        frame.focus();
    } catch (error) {
        cleanup();
        throw error;
    } finally {
        clearTimeout(ready_timer);
    }
}
