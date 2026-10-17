// Native scrolling handles wheel, touch, and focus; only the bar is replaced.
export function setup_scrollbar(viewport: HTMLElement) {
    const shell = document.createElement("div");
    shell.className = "scroll-shell";
    viewport.before(shell);
    shell.append(viewport);
    viewport.classList.add("scroll-viewport");

    const track = document.createElement("div");
    track.className = "scroll-track";
    track.tabIndex = 0;
    track.setAttribute("role", "scrollbar");
    track.setAttribute("aria-label", "Scroll content");
    track.setAttribute("aria-orientation", "vertical");
    track.setAttribute("aria-controls", viewport.id);
    track.setAttribute("aria-valuemin", "0");
    const thumb = document.createElement("div");
    thumb.className = "scroll-thumb";
    track.append(thumb);
    shell.append(track);

    let travel = 0;
    let maximum = 0;
    let drag: { id: number; y: number; top: number } | undefined;
    let scheduled = false;

    function update() {
        scheduled = false;
        maximum = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        track.hidden = maximum <= 1 || viewport.clientHeight === 0;
        const height = track.clientHeight;
        const thumb_height = Math.min(height, Math.max(
            24, height * viewport.clientHeight
                / Math.max(1, viewport.scrollHeight)
        ));
        travel = Math.max(0, height - thumb_height);
        thumb.style.height = `${thumb_height}px`;
        const offset = maximum ? viewport.scrollTop / maximum * travel : 0;
        thumb.style.transform = `translateY(${offset}px)`;
        track.setAttribute("aria-valuemax", String(maximum));
        track.setAttribute("aria-valuenow", String(Math.round(
            Math.max(0, Math.min(maximum, viewport.scrollTop))
        )));
    }

    function schedule_update() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(update);
    }

    viewport.addEventListener("scroll", schedule_update, { passive: true });
    const resize = new ResizeObserver(schedule_update);
    resize.observe(viewport);
    const mutations = new MutationObserver(schedule_update);
    mutations.observe(viewport, {
        subtree: true, childList: true, attributes: true, characterData: true
    });
    // Images can change the scroll range after the DOM mutation was handled.
    viewport.addEventListener("load", schedule_update, true);

    track.addEventListener("pointerdown", event => {
        if (event.button !== 0 || !maximum || !travel) return;
        event.preventDefault();
        track.focus({ preventScroll: true });
        if (event.target !== thumb) {
            const rect = track.getBoundingClientRect();
            viewport.scrollTop = (event.clientY - rect.top
                - thumb.clientHeight / 2) / travel * maximum;
        }
        drag = {
            id: event.pointerId, y: event.clientY, top: viewport.scrollTop
        };
        track.setPointerCapture(event.pointerId);
    });
    track.addEventListener("pointermove", event => {
        if (!drag || drag.id !== event.pointerId || !travel) return;
        viewport.scrollTop = drag.top
            + (event.clientY - drag.y) / travel * maximum;
    });
    track.addEventListener("lostpointercapture", () => { drag = undefined; });
    function finish_drag(event: PointerEvent) {
        if (track.hasPointerCapture(event.pointerId)) {
            track.releasePointerCapture(event.pointerId);
        }
        drag = undefined;
    }
    track.addEventListener("pointerup", finish_drag);
    track.addEventListener("pointercancel", finish_drag);
    track.addEventListener("wheel", event => {
        const unit = event.deltaMode === 1 ? 16
            : event.deltaMode === 2 ? viewport.clientHeight : 1;
        viewport.scrollTop += event.deltaY * unit;
        event.preventDefault();
    }, { passive: false });
    track.addEventListener("keydown", event => {
        const page = viewport.clientHeight * .9;
        const targets: Record<string, number> = {
            ArrowDown: viewport.scrollTop + 40,
            ArrowUp: viewport.scrollTop - 40,
            PageDown: viewport.scrollTop + page,
            PageUp: viewport.scrollTop - page,
            Home: 0,
            End: maximum
        };
        if (!(event.key in targets)) return;
        event.preventDefault();
        event.stopPropagation();
        viewport.scrollTop = targets[event.key];
    });
    update();
}
