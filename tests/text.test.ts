import { describe } from "mocha";
import { itWithEcho, itWithTerminal } from "./components";

describe("Text modification", () => {
    itWithTerminal("insert character", 5, 5, (source, renderer, input, term) => {
        source.send("12345");
        source.send("\x1b[1;3H");
        renderer.expectCursorAt(2, 0);

        source.send("\x1b[2@");
        renderer.expectCursorAt(2, 0); // cursor should not change
        renderer.expectLine(0, 0, [ "1", "2", null, null, "3" ]);
        renderer.expectLine(0, 1, [ null, null, null, null, null ]);

        source.send("54");
        renderer.expectLine(0, 0, "12543");

        source.send("\x1b[1;2H");
        source.send("\x1b[0@");
        renderer.expectLine(0, 0, "12543");

        source.send("\x1b[10@");
        renderer.expectLine(0, 0, [ "1", null, null, null, null ]);
    });

    itWithTerminal("delete character", 5, 5, (source, renderer, input, term) => {
        source.send("12345");
        source.send("67890");
        source.send("\x1b[1;3H");
        renderer.expectCursorAt(2, 0);

        source.send("\x1b[2P");
        renderer.expectCursorAt(2, 0);
        renderer.expectLine(0, 0, [ "1", "2", "5", null, null ]);
        renderer.expectLine(0, 1, "67890");

        source.send("\x1b[2;2H");
        renderer.expectCursorAt(1, 1);

        source.send("\x1b[0P");
        renderer.expectLine(0, 0, [ "1", "2", "5", null, null ]);
        renderer.expectLine(0, 1, "67890");

        source.send("\x1b[100P");
        renderer.expectLine(0, 0, [ "1", "2", "5", null, null ]);
        renderer.expectLine(0, 1, [ "6", null, null, null, null ]);
    });

    itWithTerminal("erase character", 5, 5, (source, renderer, input, term) => {
        source.send("12345");
        source.send("67890");
        source.send("\x1b[1;3H");
        renderer.expectCursorAt(2, 0);

        source.send("\x1b[X");
        renderer.expectCursorAt(2, 0);
        renderer.expectLine(0, 0, [ "1", "2", null, "4", "5" ]);
        renderer.expectLine(0, 1, "67890");

        source.send("\x1b[2X");
        renderer.expectCursorAt(2, 0);
        renderer.expectLine(0, 0, [ "1", "2", null, null, "5" ]);
        renderer.expectLine(0, 1, "67890");

        source.send("\x1b[100X");
        renderer.expectCursorAt(2, 0);
        renderer.expectLine(0, 0, [ "1", "2", null, null, null ]);
        renderer.expectLine(0, 1, "67890");
    });

    itWithTerminal("insert and delete line", 5, 5, (source, renderer, input, term) => {
        source.send("12345");
        source.send("67890");
        source.send("abcde");
        source.send("fghij");

        source.send("\x1b[2;3H");
        renderer.expectCursorAt(2, 1);

        source.send("\x1b[2L");
        renderer.expectCursorAt(2, 1);

        renderer.expectLine(0, 0, "12345");
        renderer.expectLine(0, 1, [ null, null, null, null, null ]);
        renderer.expectLine(0, 2, [ null, null, null, null, null ]);
        renderer.expectLine(0, 3, "67890");
        renderer.expectLine(0, 4, "abcde");

        source.send("\x1b[1;3H");
        renderer.expectCursorAt(2, 0);

        // interplay with scroll margins
        source.send("\x1b[1;3r");

        source.send("\x1b[2L");
        renderer.expectLine(0, 0, [ null, null, null, null, null ]);
        renderer.expectLine(0, 1, [ null, null, null, null, null ]);
        renderer.expectLine(0, 2, "12345");
        renderer.expectLine(0, 3, "67890");
        renderer.expectLine(0, 4, "abcde");

        source.send("\x1b[L");
        renderer.expectLine(0, 0, [ null, null, null, null, null ]);
        renderer.expectLine(0, 1, [ null, null, null, null, null ]);
        renderer.expectLine(0, 2, [ null, null, null, null, null ]);
        renderer.expectLine(0, 3, "67890");
        renderer.expectLine(0, 4, "abcde");

        source.send("\x1b[r");
        renderer.expectCursorAt(0, 0);

        source.send("\x1b[M");
        renderer.expectLine(0, 0, [ null, null, null, null, null ]);
        renderer.expectLine(0, 1, [ null, null, null, null, null ]);
        renderer.expectLine(0, 2, "67890");
        renderer.expectLine(0, 3, "abcde");
        renderer.expectLine(0, 4, [ null, null, null, null, null ]);

        source.send("\x1b[10M");
        renderer.expectLine(0, 0, [ null, null, null, null, null ]);
        renderer.expectLine(0, 1, [ null, null, null, null, null ]);
        renderer.expectLine(0, 2, [ null, null, null, null, null ]);
        renderer.expectLine(0, 3, [ null, null, null, null, null ]);
        renderer.expectLine(0, 4, [ null, null, null, null, null ]);
    });

    itWithTerminal("erase in line", 5, 5, (source, renderer, input, term) => {
        source.send("12345");
        source.send("67890");
        source.send("\x1b[1;3H");
        renderer.expectCursorAt(2, 0);

        source.send("\x1b[K"); // default 0
        renderer.expectCursorAt(2, 0);
        renderer.expectLine(0, 0, [ "1", "2", null, null, null ]);
        renderer.expectLine(0, 1, "67890");

        source.send("ab");
        source.send("\x1b[2D");
        renderer.expectCursorAt(2, 0);
        renderer.expectLine(0, 0, [ "1", "2", "a", "b", null ]);
        renderer.expectLine(0, 1, "67890");

        source.send("\x1b[1K");
        renderer.expectCursorAt(2, 0);
        renderer.expectLine(0, 0, [ null, null, null, "b", null ]);
        renderer.expectLine(0, 1, "67890");

        source.send("\x1b[2K");
        renderer.expectCursorAt(2, 0);
        renderer.expectLine(0, 0, [ null, null, null, null, null ]);
        renderer.expectLine(0, 1, "67890");

        // should be ignored
        source.send("\x1b[3K");
        renderer.expectLine(0, 0, [ null, null, null, null, null ]);
        renderer.expectLine(0, 1, "67890");
    });

    itWithTerminal("erase in display", 5, 5, (source, renderer, input, term) => {
        source.send("12345");
        source.send("67890");
        source.send("abcde");
        source.send("fghij");
        source.send("klmn");
        source.send("\x1b[3;3H");
        renderer.expectCursorAt(2, 2);

        source.send("\x1b[J"); // default 0
        renderer.expectCursorAt(2, 2);
        renderer.expectLine(0, 0, "12345");
        renderer.expectLine(0, 1, "67890");
        renderer.expectLine(0, 2, [ "a", "b", null, null, null ]);
        renderer.expectLine(0, 3, [ null, null, null, null, null ]);
        renderer.expectLine(0, 4, [ null, null, null, null, null ]);

        source.send("\x1b[A"); // default 0
        renderer.expectCursorAt(2, 1);

        source.send("\x1b[1J");
        renderer.expectLine(0, 0, [ null, null, null, null, null ]);
        renderer.expectLine(0, 1, [ null, null, null, "9", "0" ]);
        renderer.expectLine(0, 2, [ "a", "b", null, null, null ]);
        renderer.expectLine(0, 3, [ null, null, null, null, null ]);
        renderer.expectLine(0, 4, [ null, null, null, null, null ]);

        source.send("\x1b[2J");
        renderer.expectLine(0, 0, [ null, null, null, null, null ]);
        renderer.expectLine(0, 1, [ null, null, null, null, null ]);
        renderer.expectLine(0, 2, [ null, null, null, null, null ]);
        renderer.expectLine(0, 3, [ null, null, null, null, null ]);
        renderer.expectLine(0, 4, [ null, null, null, null, null ]);

        source.send("123");
        source.send("\x1b[3J");
        renderer.expectLine(0, 0, [ null, null, null, null, null ]);
        renderer.expectLine(0, 1, [ null, null, "1", "2", "3" ]);
        renderer.expectLine(0, 2, [ null, null, null, null, null ]);
        renderer.expectLine(0, 3, [ null, null, null, null, null ]);
        renderer.expectLine(0, 4, [ null, null, null, null, null ]);
    });
});
