import { describe } from "mocha";
import { itWithTerminal } from "./components";

import { SGRColor, Intensity, BlinkStatus, TextStyle } from "../src/yterm/core/renderer";

describe("Terminal graph rendition", () => {
    itWithTerminal("has the correct default style", 5, 5, (source, renderer, input, term) => {
        source.send("a");
        renderer.expectBlockStyle(0, 0, "a", {
            "background": SGRColor.SGR_COLOR_DEFAULT,
            "foreground": SGRColor.SGR_COLOR_DEFAULT,
            "style": TextStyle.STYLE_NORMAL,
            "intensity": Intensity.SGR_INTENSITY_NORMAL,
            "blink": BlinkStatus.BLINK_NONE,
            "reversed": false,
        });
    });
    
    itWithTerminal("resets context correctly", 5, 5, (source, renderer, input, term) => {
        source.send("\x1b[31mab\x1b[0mc");

        renderer.expectBlockStyle(0, 0, "a", {
            "background": SGRColor.SGR_COLOR_DEFAULT,
            "foreground": SGRColor.SGR_COLOR_RED,
            "style": TextStyle.STYLE_NORMAL,
            "intensity": Intensity.SGR_INTENSITY_NORMAL,
            "blink": BlinkStatus.BLINK_NONE,
            "reversed": false
        });

        renderer.expectBlockStyle(1, 0, "b", {
            "background": SGRColor.SGR_COLOR_DEFAULT,
            "foreground": SGRColor.SGR_COLOR_RED,
            "style": TextStyle.STYLE_NORMAL,
            "intensity": Intensity.SGR_INTENSITY_NORMAL,
            "blink": BlinkStatus.BLINK_NONE,
            "reversed": false
        });

        renderer.expectBlockStyle(2, 0, "c", {
            "background": SGRColor.SGR_COLOR_DEFAULT,
            "foreground": SGRColor.SGR_COLOR_DEFAULT,
            "style": TextStyle.STYLE_NORMAL,
            "intensity": Intensity.SGR_INTENSITY_NORMAL,
            "blink": BlinkStatus.BLINK_NONE,
            "reversed": false
        });
    });

    itWithTerminal("sets foreground correctly", 5, 5, (source, renderer, input, term) => {
        source.send("\x1b[31ma\x1b[31;32mb\x1b[33mc");

        renderer.expectBlockStyle(0, 0, "a", {
            "foreground": SGRColor.SGR_COLOR_RED
        });

        renderer.expectBlockStyle(1, 0, "b", {
            "foreground": SGRColor.SGR_COLOR_GREEN
        });

        renderer.expectBlockStyle(2, 0, "c", {
            "foreground": SGRColor.SGR_COLOR_YELLOW
        });
    });

    itWithTerminal("sets background correctly", 5, 5, (source, renderer, input, term) => {
        source.send("\x1b[41ma\x1b[41;42mb\x1b[43mc");

        renderer.expectBlockStyle(0, 0, "a", {
            "background": SGRColor.SGR_COLOR_RED
        });

        renderer.expectBlockStyle(1, 0, "b", {
            "background": SGRColor.SGR_COLOR_GREEN
        });

        renderer.expectBlockStyle(2, 0, "c", {
            "background": SGRColor.SGR_COLOR_YELLOW
        });
    });

    itWithTerminal("sets style correctly", 5, 5, (source, renderer, input, term) => {
        source.send("\x1b[3ma\x1b[3;23mb\x1b[23;3mc");

        renderer.expectBlockStyle(0, 0, "a", {
            "style": TextStyle.STYLE_ITALIC
        });

        renderer.expectBlockStyle(1, 0, "b", {
            "style": TextStyle.STYLE_NORMAL
        });

        renderer.expectBlockStyle(2, 0, "c", {
            "style": TextStyle.STYLE_ITALIC
        });
    });

    itWithTerminal("sets intensity correctly", 5, 5, (source, renderer, input, term) => {
        source.send("\x1b[1ma\x1b[2mb\x1b[22mc");

        renderer.expectBlockStyle(0, 0, "a", {
            "intensity": Intensity.SGR_INTENSITY_HIGH
        });

        renderer.expectBlockStyle(1, 0, "b", {
            "intensity": Intensity.SGR_INTENSITY_LOW
        });

        renderer.expectBlockStyle(2, 0, "c", {
            "intensity": Intensity.SGR_INTENSITY_NORMAL
        });
    });

    itWithTerminal("sets blink correctly", 5, 5, (source, renderer, input, term) => {
        source.send("\x1b[5ma\x1b[6mb\x1b[25mc");

        renderer.expectBlockStyle(0, 0, "a", {
            "blink": BlinkStatus.BLINK_SLOW
        });

        renderer.expectBlockStyle(1, 0, "b", {
            "blink": BlinkStatus.BLINK_FAST
        });

        renderer.expectBlockStyle(2, 0, "c", {
            "blink": BlinkStatus.BLINK_NONE
        });
    });

    itWithTerminal("sets reverse correctly", 5, 5, (source, renderer, input, term) => {
        source.send("\x1b[7ma\x1b[27mb");

        renderer.expectBlockStyle(0, 0, "a", {
            "reversed": true
        });

        renderer.expectBlockStyle(1, 0, "b", {
            "reversed": false
        });
    });
});
