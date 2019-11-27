import { CanvasRenderer, Font } from "./yterm/canvas";
import { WebSocketSource } from "./yterm/source";
import { KeyboardEventInput } from "./yterm/input";
import { Terminal } from "./yterm/terminal";

import { TangoColorScheme } from "./yterm/schemes";
import { SGRColor } from "./yterm/renderer";

const colorScheme = new TangoColorScheme();
const font = new Font("Ubuntu Mono", 16);

const main = document.getElementById("main");
const renderer = new CanvasRenderer(main!, 80, 24, font, colorScheme);
const source = new WebSocketSource("ws://localhost:3131");
const input = new KeyboardEventInput(document);
const term = new Terminal(source, renderer, input);

main!.style.background = colorScheme.getSGRBackground(SGRColor.SGR_COLOR_DEFAULT);

const eventLoop = () => {
    document.getElementById("title")!.innerText = term.getTitle();
    window.requestAnimationFrame(eventLoop);
};

eventLoop();

/*

demo:

telnet towel.blinkenlights.nl
vi
sl
cmatrix
screenfetch
less
curl -L https://raw.githubusercontent.com/keroserene/rickrollrc/master/roll.sh | bash

*/


/**
 * Performance tuning
 * 1. applySGRAttributes
 * 2. frequent calls to printLetter/setBlock
 * 3. optimize scroll
 * 4. broken sequences across buffers
 */