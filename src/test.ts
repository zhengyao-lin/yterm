import { CanvasRenderer } from "./yterm/canvas";
import { WebSocketSource } from "./yterm/source";
import { KeyboardEventInput } from "./yterm/input";
import { Terminal } from "./yterm/terminal";

const main = document.getElementById("main");
const renderer = new CanvasRenderer(main!);
const source = new WebSocketSource("ws://localhost:3131");
const input = new KeyboardEventInput(document);
const term = new Terminal(source, renderer, input);
