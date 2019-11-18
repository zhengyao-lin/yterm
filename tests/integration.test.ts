import { describe, it } from "mocha";

import { Input } from "../src/yterm/input";
import { Terminal } from "../src/yterm/terminal";
import { EchoSource, TestRenderer } from "./components";
import { Source } from "../src/yterm/source";

function itWithTerminal (
    msg: string, columns: number, rows: number,
    f: (s: Source, r: TestRenderer, i: Input, t: Terminal) => void
) {
    it(msg, () => {
        const source = new EchoSource();
        const renderer = new TestRenderer(columns, rows);
        const input = new Input();
        const term = new Terminal(source, renderer, input);
        f(source, renderer, input, term);
    });
}

describe("Terminal", () => {
    itWithTerminal("supports basic printing", 10, 8, (source, renderer, input, term) => {
        input.input("12345678901");
        renderer.expectLine(0, 0, "1234567890");
        renderer.expectLine(0, 1, "1");
        renderer.expectLine(1, 1, [ null, null, null, null ]);
    });

    itWithTerminal("supports scrolling", 2, 2, (source, renderer, input, term) => {
        input.input("123");
        renderer.expectLine(0, 0, "12");
        renderer.expectLine(0, 1, [ "3", null ]);

        input.input("4");
        renderer.expectLine(0, 0, "34");
        renderer.expectLine(0, 1, [ null, null ]);
    });

    itWithTerminal("handles backspace", 5, 1, (source, renderer, input, term) => {
        input.input("1234");

        renderer.expectCursorAt(4, 0);
        input.input("\x08");
        renderer.expectCursorAt(3, 0);
        input.input("\x08\x08");
        renderer.expectCursorAt(1, 0);
    });

    itWithTerminal("moves cursor correctly", 5, 5, (source, renderer, input, term) => {
        renderer.expectCursorAt(0, 0);

        input.input("\x1b[A");
        renderer.expectCursorAt(0, 0);

        input.input("\x1b[B");
        renderer.expectCursorAt(0, 1);

        input.input("\x1b[C");
        renderer.expectCursorAt(1, 1);

        input.input("\x1b[D");
        renderer.expectCursorAt(0, 1);

        input.input("\x1b[3B");
        renderer.expectCursorAt(0, 4);

        input.input("\x1b[4C");
        renderer.expectCursorAt(4, 4);

        input.input("\x1b[4A");
        renderer.expectCursorAt(4, 0);
    });
});
