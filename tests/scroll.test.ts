import { describe } from "mocha";
import { itWithEcho } from "./components";

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
});
