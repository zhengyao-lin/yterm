import { parseANSIStream, ANSISequence, ANSICommand } from "./ansi";
import { Source } from "./source";
import { Input } from "./input";
import { Renderer } from "./renderer";
import { assert } from "./utils";

export class Terminal {
    private source: Source;
    private renderer: Renderer;
    private input: Input;

    constructor (source: Source, renderer: Renderer, input: Input) {
        this.source = source;
        this.renderer = renderer;
        this.input = input;

        this.renderer.setCursor(0, 0);

        this.source.onData(data => {
            parseANSIStream(data, chunk => {
                if (chunk instanceof ANSISequence) {
                    this.handleANSISequence(chunk);
                } else {
                    this.printText(chunk);
                }
            });
        });

        this.input.onInput(data => {
            this.source.write(data);
        });

        // ESC [ 8 ; Ph ; Pw t
        // signal bash to change dimension
        // this.source.write(`\x1b[8;${this.columns};${this.rows}t`);
    }

    newline () {
        const { row } = this.renderer.getCursor();

        if (this.renderer.isInRange(0, row + 1)) {
            this.renderer.setCursor(0, row + 1);
        } else {
            this.renderer.scrollDown(1);
            this.renderer.setCursor(0, row);
        }
    }

    // erase inclusively
    eraseInRow (row: number, from: number, to: number) {
        assert(from <= to, "illegal erasure");

        for (let i = from; i <= to; i++) {
            this.renderer.printLetter(null, i, row);
        }
    }

    // delete a chunk of characters and move the following parts back
    deleteInRow (row: number, from: number, to: number) {
        const { columns } = this.renderer.getGridSize();

        this.eraseInRow(row, from, to);

        const remainingBlocks = [];

        for (let i = to + 1; i < columns; i++) {
            remainingBlocks.push(this.renderer.getBlock(i, row));
            this.renderer.printLetter(null, i, row);
        }

        let column = from;

        for (const block of remainingBlocks) {
            this.renderer.setBlock(block, column, row);
            column++;
        }
    }
    
    insertInRow (row: number, from: number, n: number) {
        const { columns } = this.renderer.getGridSize();
        assert(from + n <= columns, "inserting too many characters");
    
        const savedBlock = [];

        // save blocks in [from, columns - n]
        for (let i = from; i < columns - n; i++) {
            savedBlock.push(this.renderer.getBlock(i, row));
        }

        for (let i = from; i < columns; i++) {
            if (i < from + n) {
                this.renderer.printLetter(null, i, row);
            } else {
                this.renderer.setBlock(savedBlock[i - from - n], i, row);
            }
        }
    }

    cursorMove (n: number, action: string) {
        const { column, row } = this.renderer.getCursor();

        switch (action) {
            case "A": // up
                if (this.renderer.isInRange(column, row - n)) {
                    this.renderer.setCursor(column, row - n);
                }
                break;

            case "B": // down
                if (this.renderer.isInRange(column, row + n)) {
                    this.renderer.setCursor(column, row + n);
                }
                break;

            case "C": // right
                if (this.renderer.isInRange(column + n, row)) {
                    this.renderer.setCursor(column + n, row);
                }
                break;

            case "D": // left
                if (this.renderer.isInRange(column - n, row)) {
                    this.renderer.setCursor(column - n, row);
                }
                break;

            default:
                assert(false, `unsupported action ${action}`);
        }
    }

    handleANSISequence (seq: ANSISequence) {
        console.log(seq.toString());

        switch (seq.cmd) {
            case ANSICommand.CTRL_BACKSPACE:
                this.cursorMove(1, "D"); // move left for 1 unit
                break;

            case ANSICommand.ESC_CURSOR_MOVE: {
                const [ n, action ] = seq.args;
                this.cursorMove(n, action);
                break;
            }

            case ANSICommand.ESC_DELETE_CHAR: {
                const [ n ] = seq.args;
                const { column, row } = this.renderer.getCursor();
                this.deleteInRow(row, column, column + n - 1);
                break;
            }

            case ANSICommand.CTRL_TAB:
                this.printText("    ");
                break;

            case ANSICommand.CTRL_CARRIAGE_RETURN:
                const { row } = this.renderer.getCursor();
                this.renderer.setCursor(0, row);
                break;

            case ANSICommand.ESC_SET_DIMENSIONS: {
                const [ rows, columns ] = seq.args;

                if (rows > 0 && columns > 0) {
                    this.renderer.setGridSize(columns, rows);
                }

                break;
            }

            case ANSICommand.ESC_ERASE_IN_LINE: {
                const [ code ] = seq.args;

                if (isNaN(code) || code == 0) {
                    const { column, row } = this.renderer.getCursor();
                    this.eraseInRow(row, column, this.renderer.getGridSize().columns - 1);
                } else {
                    console.log(`unsupported code erase in line ${code}`);
                }

                break;
            }

            case ANSICommand.ESC_INSERT_CHAR: {
                const [ n ] = seq.args;
                const { column, row } = this.renderer.getCursor();
                this.insertInRow(row, column, n);

                break;
            }

            default:
                console.log("ignored", seq);
        }
    }

    printText (text: string) {
        console.log("printing", text);

        for (const char of text) {
            if (char == "\n") {
                this.newline();
            } else {
                const { column, row } = this.renderer.getCursor();

                this.renderer.printLetter(char, column, row);

                if (!this.renderer.isInRange(column + 1, row)) {
                    this.newline();
                } else {
                    this.renderer.setCursor(column + 1, row);
                }
            }
        }
    }
}
