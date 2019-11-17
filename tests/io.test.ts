import { describe } from "mocha";
import { itWithEcho } from "./components";

describe("Terminal basic", () => {
    itWithEcho("supports basic printing", 10, 8, (source, renderer, input, term) => {
        input.input("12345678901");
        renderer.expectLine(0, 0, "1234567890");
        renderer.expectLine(0, 1, "1");
        renderer.expectLine(1, 1, [ null, null, null, null ]);
    });

    itWithEcho("supports scrolling", 2, 2, (source, renderer, input, term) => {
        input.input("123");
        renderer.expectLine(0, 0, "12");
        renderer.expectLine(0, 1, [ "3", null ]);

        input.input("4");
        renderer.expectLine(0, 0, "34");
        renderer.expectLine(0, 1, [ null, null ]);
    });

    itWithEcho("handles backspace", 5, 1, (source, renderer, input, term) => {
        input.input("1234");

        renderer.expectCursorAt(4, 0);
        input.input("\x08");
        renderer.expectCursorAt(3, 0);
        input.input("\x08\x08");
        renderer.expectCursorAt(1, 0);
    });
});
