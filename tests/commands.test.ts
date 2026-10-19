import assert from "node:assert/strict";
import { test } from "node:test";
import { matching_commands } from "../src/ui/commands.ts";

test(
    "command search supports palette prefixes and multiple words",
    () => {
        assert.deepEqual(
            matching_commands("  >  UNLOAD inactive  ").map((item) => item.id),
            [
                "unload-all",
            ],
        );
        assert.deepEqual(
            matching_commands("memory select").map((item) => item.id),
            [
                "unload",
            ],
        );
    },
);

test(
    "commands can be found by the task they perform",
    () => {
        for (const query of [
            "settings",
            "keyboard",
            "overlay",
            "preferences",
        ]) {
            assert.deepEqual(
                matching_commands(query).map((item) => item.id),
                [
                    "settings",
                ],
            );
        }
        assert.deepEqual(
            matching_commands("remove copies").map((item) => item.id),
            [
                "duplicates",
            ],
        );
        assert.deepEqual(
            matching_commands("rescan").map((item) => item.id),
            [
                "refresh",
            ],
        );
    },
);

test(
    "empty searches show all commands and unknown searches show none",
    () => {
        assert.equal(matching_commands(" ").length, 6);
        assert.equal(matching_commands(">").length, 6);
        assert.deepEqual(matching_commands("no such command"), []);
    },
);
