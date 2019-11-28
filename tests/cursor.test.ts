import { describe } from "mocha";
import { itWithTerminal } from "./components";

describe("Terminal cursor positioning", () => {
    itWithTerminal("moves cursor correctly in four directions", 5, 5, (source, renderer, input, term) => {
        renderer.expectCursorAt(0, 0);

        source.send("\x1b[A");
        renderer.expectCursorAt(0, 0);

        source.send("\x1b[B");
        renderer.expectCursorAt(0, 1);

        source.send("\x1b[C");
        renderer.expectCursorAt(1, 1);

        source.send("\x1b[D");
        renderer.expectCursorAt(0, 1);

        source.send("\x1b[3B");
        renderer.expectCursorAt(0, 4);

        source.send("\x1b[4C");
        renderer.expectCursorAt(4, 4);

        source.send("\x1b[4A");
        renderer.expectCursorAt(4, 0);
    });

    itWithTerminal("handles cursor horizontal absolute positioning", 5, 5, (source, renderer, input, term) => {
        renderer.expectCursorAt(0, 0);

        source.send("\x1b[3G");
        renderer.expectCursorAt(2, 0);

        // out-of-bound requests should be
        // changed to the nearest position
        source.send("\x1b[10G");
        renderer.expectCursorAt(4, 0);

        source.send("\x1b[0G");
        renderer.expectCursorAt(0, 0);

        // handles alias correctly
        source.send("\x1b[4`");
        renderer.expectCursorAt(3, 0);

        source.send("\x1b[3B");
        renderer.expectCursorAt(3, 3);

        source.send("\x1b[5G");
        renderer.expectCursorAt(4, 3);
    });

    itWithTerminal("handles cursor vertical absolute positioning", 5, 5, (source, renderer, input, term) => {
        renderer.expectCursorAt(0, 0);

        source.send("\x1b[3d");
        renderer.expectCursorAt(0, 2);

        source.send("\x1b[1d");
        renderer.expectCursorAt(0, 0);

        source.send("\x1b[0d");
        renderer.expectCursorAt(0, 0);

        source.send("\x1b[10d");
        renderer.expectCursorAt(0, 4);
    });

    itWithTerminal("handles cursor direct positioning", 5, 5, (source, renderer, input, term) => {
        renderer.expectCursorAt(0, 0);

        source.send("\x1b[1;1H");
        renderer.expectCursorAt(0, 0);

        source.send("\x1b[5;5H");
        renderer.expectCursorAt(4, 4);

        source.send("\x1b[4;5H");
        renderer.expectCursorAt(4, 3);

        source.send("\x1b[3;2H");
        renderer.expectCursorAt(1, 2);

        // out-of-bound requests
        // would be set the cursor to
        // the nearest position
        source.send("\x1b[6;6H");
        renderer.expectCursorAt(4, 4);

        source.send("\x1b[0;0H");
        renderer.expectCursorAt(0, 0);

        // supports alias for compatibility
        source.send("\x1b[1;1f");
        renderer.expectCursorAt(0, 0);

        source.send("\x1b[5;5f");
        renderer.expectCursorAt(4, 4);

        source.send("\x1b[4;5f");
        renderer.expectCursorAt(4, 3);

        source.send("\x1b[3;2f");
        renderer.expectCursorAt(1, 2);
    });

    itWithTerminal("supports saving and restoring cursor position", 5, 5, (source, renderer, input, term) => {
        source.send("\x1b[4;5H");
        renderer.expectCursorAt(4, 3);

        source.send("\x1b7");
        renderer.expectCursorAt(4, 3);

        source.send("\x1b[1;1H");
        renderer.expectCursorAt(0, 0);

        source.send("\x1b8");
        renderer.expectCursorAt(4, 3);

        source.send("\x1b7");
        renderer.expectCursorAt(4, 3);

        source.send("\x1b[3;2H");
        renderer.expectCursorAt(1, 2);

        source.send("\x1b7");
        renderer.expectCursorAt(1, 2);

        source.send("\x1b[1;1H");
        renderer.expectCursorAt(0, 0);

        source.send("\x1b8");
        renderer.expectCursorAt(1, 2);

        source.send("\x1b8");
        renderer.expectCursorAt(1, 2); // buffer size is one
    });

    itWithTerminal("supports reverse index", 2, 2, (source, renderer, input, term) => {
        source.send("12");
        renderer.expectCursorAt(0, 1);

        source.send("\x1bM"); // reverse index/move the cursor up by one line
        renderer.expectCursorAt(0, 0);

        source.send("\x1bM"); // reverse index on the top would scroll down the screen
        renderer.expectCursorAt(0, 0);
        renderer.expectLine(0, 0, [ null, null ]);
        renderer.expectLine(0, 1, "12");
    });

    itWithTerminal("supports reporting cursor position", 5, 5, (source, renderer, input, term) => {
        source.send("\x1b[4;5H");
        renderer.expectCursorAt(4, 3);

        source.send("\x1b[6n");
        source.expectRecv("\x1b[4;5R");
    });
});
