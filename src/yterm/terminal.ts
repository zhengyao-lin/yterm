import { fullParser, ControlSequence, ControlSequenceParser } from "./control";
import { Source } from "./source";
import { Input } from "./input";
import { Renderer, applySGRAttribute } from "./renderer";
import { assert } from "./utils";

/**
 * Core class for a terminal
 */
export class Terminal {
    /** 
     * "vt100 with no options"
     * https://vt100.net/docs/vt100-ug/chapter3.html#DA
     */
    static PRIMARY_DEVICE_ATTRIBUTE = "\x1b[?1;0c";

    private source: Source;
    private renderer: Renderer;
    private input: Input;
    private controlParser: ControlSequenceParser;

    private savedCursorColumn: number;
    private savedCursorRow: number;

    private scrollTopMargin: number;
    private scrollBottomMargin: number;

    private title: string;

    private controlHandlers: Record<string, (seq: ControlSequence) => void>;

    constructor (source: Source, renderer: Renderer, input: Input) {
        this.source = source;
        this.renderer = renderer;
        this.input = input;
        this.controlParser = fullParser;

        this.controlParser.onChunk(chunk => {
            if (chunk instanceof ControlSequence) {
                this.handleControlSequence(chunk);
            } else {
                this.printText(chunk);
            }
        });

        this.source.onData(data => {
            this.controlParser.pushData(data);
        });

        this.input.onInput(data => {
            this.source.write(data);
        });

        this.renderer.setCursor(0, 0);

        this.savedCursorColumn = -1;
        this.savedCursorRow = -1;

        this.scrollTopMargin = 0;
        this.scrollBottomMargin = this.renderer.getGridSize().rows - 1;

        this.title = "";

        this.controlHandlers = {};

        this.initControlHandlers();
    }

    getTitle () {
        return this.title;
    }

    newline () {
        const { row } = this.renderer.getCursor();

        if (row + 1 <= this.scrollBottomMargin) {
            this.renderer.setCursor(0, row + 1);
        } else {
            this.renderer.scroll(1, this.scrollTopMargin, this.scrollBottomMargin);
            this.renderer.setCursor(0, this.scrollBottomMargin);
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
            // NOTE: A/B/C/D would NOT ignore out-of-bound requests
            // but rather set the cursor position to the nearest
            // in-bound position

            case "A": // up
                this.renderer.setCursor(column, row - n);
                break;

            case "B": // down
                this.renderer.setCursor(column, row + n);
                break;

            case "C": // right
                this.renderer.setCursor(column + n, row);
                break;

            case "D": // left
                this.renderer.setCursor(column - n, row);
                break;

            case "H": // home (0, 0)
                this.renderer.setCursor(0, 0);
                break;

            case "F": // end
                this.renderer.setCursor(columns - 1, rows - 1);
                break;

            case "`":
            case "G": { // horizontal absolute positioning
                let column = n;
                const { row } = this.renderer.getCursor();

                column -= 1;

                this.renderer.setCursor(column, row);

                break;
            }

            case "d": { // vertical absolute positioning
                let row = n;
                const { column } = this.renderer.getCursor();

                row -= 1;

                this.renderer.setCursor(column, row);

                break;
            }

            // reverse index
            case "M": {
                // ignoring n

                const { column, row } = this.renderer.getCursor();

                if (row == this.scrollTopMargin) {
                    // scroll up
                    this.renderer.scroll(-1, this.scrollTopMargin, this.scrollBottomMargin);
                } else {
                    this.renderer.setCursor(column, row - 1);
                }

                break;
            }

            default:
                assert(false, `unsupported action ${action}`);
        }
    }

    printText (text: string) {
        // console.log("printing", text);

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

    /**
     * Execute the given control sequence
     */
    handleControlSequence (seq: ControlSequence) {
        const handler = this.controlHandlers[seq.cmd];

        if (typeof handler == "function") {
            handler(seq);
            // console.log(seq.toString());
        } else {
            console.log("not implemented", seq);
        }
    }

    registerHandler (cmd: string, handler: (seq: ControlSequence) => void) {
        this.controlHandlers[cmd] = handler;
    }

    initControlHandlers () {
        this.registerHandler("CONTROL_OS_CONTROL", seq => {
            const [ code, param ] = seq.args;

            switch (code) {
                case 0:
                    this.title = param;
                    break;

                default:
                    console.log(`unsupported os control ${code};${param}`);
            }
        });

        this.registerHandler("CONTROL_BACKSPACE", _ => {
            this.cursorMove(1, "D");
        });

        this.registerHandler("CONTROL_CURSOR_MOVE", seq => {
            const [ n, action ] = seq.args;
            this.cursorMove(n, action);
        });
        
        this.registerHandler("CONTROL_TAB", _ => {
            this.printText("    ");
        });

        this.registerHandler("CONTROL_CARRIAGE_RETURN", _ => {
            const { row } = this.renderer.getCursor();
            this.renderer.setCursor(0, row);
        });
        
        this.registerHandler("CONTROL_ERASE_IN_DISPLAY", seq => {
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
        });

        this.registerHandler("CONTROL_ERASE_IN_LINE", seq => {
            const [ code ] = seq.args;
            const { column, row } = this.renderer.getCursor();
            const { columns } = this.renderer.getGridSize();

            if (code == 0) {
                this.eraseInRow(row, column, columns - 1);
            } else if (code == 1) {
                this.eraseInRow(row, 0, column);
            } else if (code == 2) {
                this.eraseInRow(row, 0, columns - 1);
            } else {
                console.log(`unsupported code erase in line ${code}`);
            }
        });

        this.registerHandler("CONTROL_INSERT_CHAR", seq => {
            const [ n ] = seq.args;
            const { column, row } = this.renderer.getCursor();
            this.insertInRow(row, column, n);
        });

        this.registerHandler("CONTROL_DELETE_CHAR", seq => {
            const [ n ] = seq.args;
            const { column, row } = this.renderer.getCursor();
            this.deleteInRow(row, column, column + n - 1);
        });

        this.registerHandler("CONTROL_INSERT_LINE", seq => {
            const [ n ] = seq.args;
            const { row } = this.renderer.getCursor();
            this.renderer.scroll(-n, row, this.scrollBottomMargin);
        });

        this.registerHandler("CONTROL_DELETE_LINE", seq => {
            const [ n ] = seq.args;
            const { row } = this.renderer.getCursor();
            this.renderer.scroll(n, row, this.scrollBottomMargin);
        });

        this.registerHandler("CONTROL_GRAPHIC_RENDITION", seq => {
            const newDefault = applySGRAttribute(seq.args, this.renderer.getDefaultBlock());
            this.renderer.setDefaultBlock(newDefault);
        });

        this.registerHandler("CONTROL_CURSOR_MOVE_DIRECT", seq => {
            let [ row, column ] = seq.args;

            row -= 1;
            column -= 1;

            this.renderer.setCursor(column, row);
        });

        this.registerHandler("CONTROL_SET_RESET_MODE", seq => {
            const [ mode, action ] = seq.args;
        
            const actionsMap: Record<string, () => void> = {
                "?12h": () => this.renderer.enableCursorBlink(),
                "?12l": () => this.renderer.disableCursorBlink(),
                "?25h": () => this.renderer.showCursor(),
                "?25l": () => this.renderer.hideCursor(),
                "?1049h": () => this.renderer.useAlternativeScreen(),
                "?1049l": () => this.renderer.useMainScreen(),

                // turn on/off application cursor keys mode
                // https://the.earth.li/~sgtatham/putty/0.60/htmldoc/Chapter4.html#config-appcursor
                "?1h": () => this.input.setApplicationCursorMode(true),
                "?1l": () => this.input.setApplicationCursorMode(false),

                // "?2004"
                // bracketed paste mode
                // https://cirw.in/blog/bracketed-paste
            };

            const actionHandler = actionsMap[mode + action];

            if (typeof actionHandler == "function") {
                actionHandler();
                console.log(`set/reset mode ${mode + action}`);
            } else {
                console.log(`unsupported mode ${mode + action}`);
            }
        });
        
        this.registerHandler("CONTROL_SAVE_CURSOR", _ => {
            const { column, row } = this.renderer.getCursor();
            this.savedCursorColumn = column;
            this.savedCursorRow = row;
        });

        this.registerHandler("CONTROL_RESTORE_CURSOR", _ => {
            this.renderer.setCursor(this.savedCursorColumn, this.savedCursorRow);
        });

        this.registerHandler("CONTROL_REPORT_CURSOR", _ => {
            const { column, row } = this.renderer.getCursor();
            this.source.write(`\x1b[${row + 1};${column + 1}R`);
        });

        this.registerHandler("CONTROL_WINDOW_MANIPULATION", seq => {
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
        });

        this.registerHandler("CONTROL_SET_TOP_BOTTOM_MARGIN", seq => {
            let [ top, bottom ] = seq.args;
            const { rows } = this.renderer.getGridSize();

            // console.log(`CONTROL_SET_TOP_BOTTOM_MARGIN ${top};${bottom}`);

            if (top < 1) {
                top = 1;
            }

            if (bottom == -1 || bottom > rows) {
                bottom = rows;
            }

            if (top < bottom) {
                this.renderer.setCursor(0, 0);

                top -= 1;
                bottom -= 1;

                this.scrollTopMargin = top;
                this.scrollBottomMargin = bottom;
            } else {
                console.log(`illegal CONTROL_SET_TOP_BOTTOM_MARGIN arguments ${top};${bottom}`);
            }
        });

        this.registerHandler("CONTROL_PRIMARY_DEVICE_ATTR", _ => {
            this.source.write(Terminal.PRIMARY_DEVICE_ATTRIBUTE);
        });

        this.registerHandler("CONTROL_SECONDARY_DEVICE_ATTR", _ => {
            console.log("secondary device attributes are not supported by vt100");
        });

        this.registerHandler("CONTROL_TERTIARY_DEVICE_ATTR", _ => {
            console.log("tertiary device attributes are not supported by vt100");
        });

        this.registerHandler("CONTROL_ASCII_MODE", _ => {
            // this currently does nothing until DEC line drawing is implemented
        });
    }
}
