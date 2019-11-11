import { fullParser, ControlSequence, ControlSequenceParser } from "./control";
import { Source } from "./source";
import { Input } from "./input";
import { Renderer, Block, SGRAttribute, Intensity, SGRColor, applySGRAttribute } from "./renderer";
import { assert } from "./utils";

export class Terminal {
    private source: Source;
    private renderer: Renderer;
    private input: Input;
    private controlParser: ControlSequenceParser;

    private savedCursorColumn: number;
    private savedCursorRow: number;

    constructor (source: Source, renderer: Renderer, input: Input) {
        this.source = source;
        this.renderer = renderer;
        this.input = input;
        this.controlParser = fullParser;

        this.renderer.setCursor(0, 0);

        this.source.onData(data => {
            this.controlParser.parseStream(data, chunk => {
                if (chunk instanceof ControlSequence) {
                    this.handleControlSequence(chunk);
                } else {
                    this.printText(chunk);
                }
            });
        });

        this.input.onInput(data => {
            this.source.write(data);
        });

        this.savedCursorColumn = -1;
        this.savedCursorRow = -1;

        // ESC [ 8 ; Ph ; Pw t
        // signal bash to change dimension
        // this.source.write(`\x1b[8;${this.columns};${this.rows}t`);
    }

    newline () {
        const { row } = this.renderer.getCursor();

        if (this.renderer.isInRange(0, row + 1)) {
            this.renderer.setCursor(0, row + 1);
        } else {
            this.renderer.scroll(1);
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

    eraseInScreen (fromColumn: number, fromRow: number,
                   toColumn: number, toRow: number) {
        const { columns, rows } = this.renderer.getGridSize();

        for (let row = fromRow; row < rows; row++) {
            for (let column = row == fromRow ? fromColumn : 0;
                 column < columns; column++) {

                this.renderer.printLetter(null, column, row);

                if (column == toColumn && row == toRow) {
                    return;
                }
            }
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
        const { columns, rows } = this.renderer.getGridSize();

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

            case "H": // home (0, 0)
                this.renderer.setCursor(0, 0);
                break;

            case "F": // end
                this.renderer.setCursor(columns - 1, rows - 1);
                break;

            default:
                assert(false, `unsupported action ${action}`);
        }
    }

    handleControlSequence (seq: ControlSequence) {
        console.log(seq.toString());

        switch (seq.cmd) {
            case "CONTROL_OS_CONTROL": {
                const [ code, param ] = seq.args;

                switch (code) {
                    case 0:
                        console.log(`title changed to ${param}`);
                        break;

                    default:
                        console.log(`unsupported os control ${code};${param}`);
                }

                break;
            }

            case "CONTROL_BACKSPACE":
                this.cursorMove(1, "D"); // move left for 1 unit
                break;

            case "CONTROL_CURSOR_MOVE": {
                const [ n, action ] = seq.args;
                this.cursorMove(n, action);
                break;
            }

            case "CONTROL_DELETE_CHAR": {
                const [ n ] = seq.args;
                const { column, row } = this.renderer.getCursor();
                this.deleteInRow(row, column, column + n - 1);
                break;
            }

            case "CONTROL_TAB":
                this.printText("    ");
                break;

            case "CONTROL_CARRIAGE_RETURN":
                const { row } = this.renderer.getCursor();
                this.renderer.setCursor(0, row);
                break;

            case "CONTROL_ERASE_IN_DISPLAY": {
                const [ code ] = seq.args;
                const { columns, rows } = this.renderer.getGridSize();
                const { column: cursorColumn, row: cursorRow } = this.renderer.getCursor();

                if (code == 0) {
                    this.eraseInScreen(cursorColumn, cursorRow, columns - 1, rows - 1);
                } else if (code == 1) {
                    this.eraseInScreen(0, 0, cursorColumn, cursorRow);
                } else if (code == 2) {
                    // erase entire screen
                    this.eraseInScreen(0, 0, columns - 1, rows - 1);
                }

                break;
            }

            case "CONTROL_ERASE_IN_LINE": {
                const [ code ] = seq.args;

                if (code == 0) {
                    const { column, row } = this.renderer.getCursor();
                    this.eraseInRow(row, column, this.renderer.getGridSize().columns - 1);
                } else {
                    console.log(`unsupported code erase in line ${code}`);
                }

                break;
            }

            // case "CONTROL_INSERT_LINE": {
            //     const [ n ] = seq.args;
            //     const { column, row } = this.renderer.getCursor();
            //     this.insertLine(row, n);

            //     break;
            // }

            case "CONTROL_INSERT_CHAR": {
                const [ n ] = seq.args;
                const { column, row } = this.renderer.getCursor();
                this.insertInRow(row, column, n);

                break;
            }

            case "CONTROL_GRAPHIC_RENDITION": {
                const newDefault = applySGRAttribute(seq.args, this.renderer.getDefaultBlock());
                this.renderer.setDefaultBlock(newDefault);
                break;
            }

            case "CONTROL_CURSOR_MOVE_DIRECT": {
                let [ row, column ] = seq.args;

                row -= 1;
                column -= 1;

                if (this.renderer.isInRange(column, row)) {
                    this.renderer.setCursor(column, row);
                }

                break;
            }

            case "CONTROL_CURSOR_HORIZONTAL_POS": {
                let [ column ] = seq.args;
                const { row } = this.renderer.getCursor();

                column -= 1;

                if (this.renderer.isInRange(column, row)) {
                    this.renderer.setCursor(column, row);
                }

                break;
            }

            case "CONTROL_CURSOR_VERTICAL_POS": {
                let [ row ] = seq.args;
                const { column } = this.renderer.getCursor();

                row -= 1;

                if (this.renderer.isInRange(column, row)) {
                    this.renderer.setCursor(column, row);
                }

                break;
            }
            
            case "CONTROL_SET_RESET_MODE": {
                const [ mode, action ] = seq.args;
            
                switch (mode + action) {
                    case "?12h":
                        this.renderer.enableCursorBlink();
                        break;

                    case "?12l":
                        this.renderer.disableCursorBlink();
                        break;

                    case "?25h":
                        this.renderer.showCursor();
                        break;

                    case "?25l":
                        this.renderer.hideCursor();
                        break;

                    case "?1049h":
                        this.renderer.useAlternativeScreen();
                        break;

                    case "?1049l":
                        this.renderer.useMainScreen();
                        break;

                    // turn on/off application cursor keys mode
                    // https://the.earth.li/~sgtatham/putty/0.60/htmldoc/Chapter4.html#config-appcursor
                    case "?1h":
                        this.input.setApplicationCursorMode(true);
                        break;

                    case "?1l":
                        this.input.setApplicationCursorMode(false);
                        break;

                    case "?2004":
                        // bracketed paste mode
                        // https://cirw.in/blog/bracketed-paste

                    default:
                        console.log(`unsupported mode ${mode + action}`);
                }

                break;
            }

            case "CONTROL_SAVE_CURSOR": {
                const { column, row } = this.renderer.getCursor();
                this.savedCursorColumn = column;
                this.savedCursorRow = row;
                break;
            }

            case "CONTROL_RESTORE_CURSOR": {
                if (this.renderer.isInRange(this.savedCursorColumn, this.savedCursorRow)) {
                    this.renderer.setCursor(this.savedCursorColumn, this.savedCursorRow);
                }

                break;
            }

            case "CONTROL_REVERSE_INDEX": {
                const { column, row } = this.renderer.getCursor();

                if (row == 0) {
                    // scroll up
                    this.renderer.scroll(-1);
                } else {
                    this.renderer.setCursor(column, row - 1);
                }
            }

            case "CONTROL_WINDOW_MANIPULATION": {
                const [ code, a, b ] = seq.args;

                switch (code) {
                    case 8:
                        // resize window
                        if (a > 0 && b > 0) {
                            this.renderer.setGridSize(b, a);
                        }

                    default:
                        console.log(`unknown window manipulation code ${code};${a};${b}`);
                }

                break;
            }

            case "CONTROL_SET_TOP_BOTTOM_MARGIN":
                // TODO: support top/bottom margin
                this.renderer.setCursor(0, 0);
                break;

            case "CONTROL_SEND_DEVICE_ATTR":
                // TODO: figure out what this ID means
                console.log("device id requested");
                this.source.write("\x1b[>1;5202;0c");
                break;

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
