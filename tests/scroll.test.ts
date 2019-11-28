import { describe } from "mocha";
import { itWithEcho, itWithTerminal } from "./components";

describe("Renderer scrolling", () => {
    itWithEcho("scrolling with scroll margins", 5, 5, (source, renderer, input, term) => {
        input.input("12345");
        input.input("67890");

        renderer.scroll(-1);
        renderer.expectLine(0, 0, [ null, null, null, null, null ]);
        renderer.expectLine(0, 1, "12345");
        renderer.expectLine(0, 2, "67890");

        renderer.scroll(1);
        renderer.expectLine(0, 0, "12345");
        renderer.expectLine(0, 1, "67890");
        renderer.expectLine(0, 2, [ null, null, null, null, null ]);

        renderer.scroll(-3);
        renderer.expectLine(0, 0, [ null, null, null, null, null ]);
        renderer.expectLine(0, 1, [ null, null, null, null, null ]);
        renderer.expectLine(0, 2, [ null, null, null, null, null ]);
        renderer.expectLine(0, 3, "12345");
        renderer.expectLine(0, 4, "67890");

        renderer.scroll(1, 3, 4);
        renderer.expectLine(0, 0, [ null, null, null, null, null ]);
        renderer.expectLine(0, 1, [ null, null, null, null, null ]);
        renderer.expectLine(0, 2, [ null, null, null, null, null ]);
        renderer.expectLine(0, 3, "67890");
        renderer.expectLine(0, 4, [ null, null, null, null, null ]);

        renderer.setCursor(0, 0);
        input.input("12345");

        renderer.scroll(-3, 0, 3);
        renderer.expectLine(0, 0, [ null, null, null, null, null ]);
        renderer.expectLine(0, 1, [ null, null, null, null, null ]);
        renderer.expectLine(0, 2, [ null, null, null, null, null ]);
        renderer.expectLine(0, 3, "12345");
        renderer.expectLine(0, 4, [ null, null, null, null, null ]);
    });

    itWithTerminal("scrolling with top and bottom margin", 5, 5, (source, renderer, input, term) => {
        source.send("12345");
        source.send("67890");
        source.send("abcde");
        source.send("fghij");

        source.send("\x1b[1;3r");
        renderer.expectCursorAt(0, 0);
        
        source.send("\x1b[3;1H");
        source.send("abcdeklmno");

        renderer.expectCursorAt(0, 2);
        renderer.expectLine(0, 0, "abcde");
        renderer.expectLine(0, 1, "klmno");
        renderer.expectLine(0, 2, [ null, null, null, null, null ]);
        renderer.expectLine(0, 3, "fghij");
        renderer.expectLine(0, 4, [ null, null, null, null, null ]);

        // out-of-bounds arguments
        source.send("\x1b[0;100r");
        renderer.expectCursorAt(0, 0);

        source.send("\x1b[3;1H");

        source.send("pqrst");
        source.send("uvwxy");
        source.send("54321");

        renderer.expectLine(0, 0, "klmno");
        renderer.expectLine(0, 1, "pqrst");
        renderer.expectLine(0, 2, "uvwxy");
        renderer.expectLine(0, 3, "54321");
        renderer.expectLine(0, 4, [ null, null, null, null, null ]);

        // ignores illegal arguments
        source.send("\x1b[100;100r");
        renderer.expectCursorAt(0, 4);
    });
});
