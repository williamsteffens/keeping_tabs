import assert from "node:assert/strict";
import { test } from "node:test";
import { recorded_shortcut } from "../src/options/shortcut.ts";

const event = {
    code: "KeyK",
    key: "K",
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
};

test(
    "records modifiers and shifted physical keys",
    () => {
        assert.equal(
            recorded_shortcut(
                {
                    ...event,
                    altKey: true,
                    shiftKey: true,
                },
                false,
            ),
            "Alt+Shift+K",
        );
        assert.equal(
            recorded_shortcut(
                {
                    ...event,
                    code: "Digit1",
                    key: "!",
                    ctrlKey: true,
                    shiftKey: true,
                },
                false,
            ),
            "Ctrl+Shift+1",
        );
    },
);

test(
    "distinguishes macOS Control and Command and handles Option",
    () => {
        assert.equal(
            recorded_shortcut(
                {
                    ...event,
                    ctrlKey: true,
                },
                true,
            ),
            "MacCtrl+K",
        );
        assert.equal(
            recorded_shortcut(
                {
                    ...event,
                    metaKey: true,
                },
                true,
            ),
            "Command+K",
        );
        assert.equal(
            recorded_shortcut(
                {
                    ...event,
                    key: "˚",
                    altKey: true,
                },
                true,
            ),
            "Alt+K",
        );
    },
);

test(
    "maps navigation keys and supports function keys",
    () => {
        assert.equal(
            recorded_shortcut(
                {
                    ...event,
                    key: "ArrowUp",
                    code: "ArrowUp",
                    ctrlKey: true,
                },
                false,
            ),
            "Ctrl+Up",
        );
        assert.equal(
            recorded_shortcut(
                {
                    ...event,
                    key: "F8",
                    code: "F8",
                },
                false,
            ),
            "F8",
        );
    },
);

test(
    "rejects unsupported keys and modifier combinations",
    () => {
        assert.equal(recorded_shortcut(event, false), null);
        assert.equal(
            recorded_shortcut(
                {
                    ...event,
                    shiftKey: true,
                },
                false,
            ),
            null,
        );
        assert.equal(
            recorded_shortcut(
                {
                    ...event,
                    ctrlKey: true,
                    altKey: true,
                    shiftKey: true,
                },
                false,
            ),
            null,
        );
        assert.equal(
            recorded_shortcut(
                {
                    ...event,
                    code: "Enter",
                    key: "Enter",
                    ctrlKey: true,
                },
                false,
            ),
            null,
        );
    },
);
