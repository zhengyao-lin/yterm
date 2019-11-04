import { parseANSISequence, ANSISequence, ANSICommand } from "./ansi";
import { Source, WebSocketSource } from "./source";
import { CanvasRenderer } from "./canvas";
import { Input, KeyboardEventInput } from "./input";

class Terminal {
    static ASCII_ESCAPE = 27;

    private source: Source;
    private renderer: CanvasRenderer;
    private input: Input;

    private columns: number;
    private rows: number;

    private cursorColumn: number;
    private cursorRow: number;

    constructor (source: Source, renderer: CanvasRenderer, input: Input) {
        this.source = source;
        this.renderer = renderer;
        this.input = input;

        this.columns = 81;
        this.rows = 24;
        this.cursorColumn = 0;
        this.cursorRow = 0;

        this.renderer.setGridSize(this.columns, this.rows);
        this.renderer.setCursor(this.cursorColumn, this.cursorRow);

        this.source.onData(data => {
            this.processData(data);
        });

        this.input.onInput(data => {
            this.source.write(data);
        });

        // ESC [ 8 ; Ph ; Pw t
        // signal bash to change dimension
        // this.source.write(`\x1b[8;${this.columns};${this.rows}t`);
    }

    updateCursor () {
        this.renderer.setCursor(this.cursorColumn, this.cursorRow);
    }

    carriageReturn (render = true) {
        this.cursorColumn = 0;
        this.cursorRow++;

        if (!this.renderer.isInRange(this.cursorColumn, this.cursorRow)) {
            this.renderer.scrollDown(1, render);
            this.cursorRow--;
        }

        this.updateCursor();
    }

    // erase inclusively
    eraseInLine (row: number, from: number, to: number) {
        for (let i = from; i <= to; i++) {
            this.renderer.printLetter(null, i, row);
        }
    }

    processData (data: string) {
        // TODO: support for ANSI
        const chunks = parseANSISequence(data);

        for (const chunk of chunks) {
            if (chunk instanceof ANSISequence) {
                switch (chunk.cmd) {
                    case ANSICommand.CTRL_BACKSPACE:
                        if (this.cursorColumn != 0) {
                            this.cursorColumn--;
                        }

                        this.updateCursor();
                        break;

                    case ANSICommand.CTRL_TAB:
                        this.processData("    ");
                        break;

                    // case ANSICommand.CTRL_CARRIAGE_RETURN:
                    //     this.carriageReturn();
                    //     break;

                    case ANSICommand.ESC_SET_DIMENSIONS:
                        const [ rows, columns ] = chunk.args;

                        if (rows > 0 && columns > 0) {
                            this.columns = columns;
                            this.rows = rows;
                            this.renderer.setGridSize(columns, rows);
                        }

                        break;

                    case ANSICommand.ESC_ERASE_IN_LINE:
                        const [ code ] = chunk.args;

                        if (isNaN(code) || code == 0) {
                            this.eraseInLine(this.cursorRow, this.cursorColumn, this.columns - 1);
                        } else {
                            console.log(`unsupported code erase in line ${code}`);
                        }

                        break;

                    default:
                        console.log("ignored", chunk);
                }
            } else {
                for (const char of chunk) {
                    if (char == "\n") {
                        this.carriageReturn(false);
                    } else {
                        this.renderer.printLetter(char, this.cursorColumn, this.cursorRow);

                        this.cursorColumn++;

                        if (this.cursorColumn >= this.columns) {
                            this.carriageReturn(false);
                        }
                    }
                }
            }
        }

        this.renderer.setCursor(this.cursorColumn, this.cursorRow);

        this.renderer.renderAll();
    }
}

(() => {
    const main = document.getElementById("main");
    const renderer = new CanvasRenderer(main);

    const source = new WebSocketSource("ws://localhost:3131");

    const input = new KeyboardEventInput(document);

    const term = new Terminal(source, renderer, input);
})();
