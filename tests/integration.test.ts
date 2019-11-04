import { describe, it, Test } from "mocha";
import { expect } from "chai";

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
});
