import { fullParser, ControlSequence, ControlSequenceParser } from "./control";
import { Source } from "./source";
import { Input } from "./input";
import { Renderer, Block, Color, SGRAttribute, TextStyle, Intensity, BlinkStatus, SGRColor } from "./renderer";
import { assert } from "./utils";

/**
 * Core class for a terminal
 * All functionalities here are loosely related
 * to renderer but would require more interaction with
 * the source/input and other components
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

    private title: string;

    private controlHandlers: Record<string, (seq: ControlSequence) => void>;

    constructor (source: Source, renderer: Renderer, input: Input) {
        this.source = source;
        this.renderer = renderer;
        this.input = input;
        this.controlParser = fullParser();

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

        this.title = "";

        this.controlHandlers = {};

        this.initControlHandlers();
    }

    getTitle () {
        return this.title;
    }

    newline () {
        const { row } = this.renderer.getCursor();
        const { bottom } = this.renderer.getScrollMargins();

        if (row == bottom) {
            this.renderer.scroll(1);
            this.renderer.setCursor(0, row);
        } else {
            this.renderer.setCursor(0, row + 1);
        }
    }

    // erase inclusively
    eraseInRow (row: number, from: number, to: number) {
        assert(from <= to, "illegal erasure");

        const { columns } = this.renderer.getSize();

        if (to >= columns) {
            to = columns - 1;
        }

        for (let i = from; i <= to; i++) {
            this.renderer.setBlock(null, i, row);
        }
    }

    eraseInScreen (fromColumn: number, fromRow: number,
                   toColumn: number, toRow: number) {
        const { columns, rows } = this.renderer.getSize();

        for (let row = fromRow; row < rows; row++) {
            for (let column = row == fromRow ? fromColumn : 0;
                 column < columns; column++) {

                this.renderer.setBlock(null, column, row);

                if (column == toColumn && row == toRow) {
                    return;
                }
            }
        }
    }

    // delete a chunk of characters and move the following parts back
    deleteInRow (row: number, from: number, n: number) {
        const { columns } = this.renderer.getSize();

        for (let i = from; i < columns; i++) {
            if (i < columns + n && this.renderer.isInRange(i + n, row)) {
                this.renderer.setBlock(this.renderer.getBlock(i + n, row), i, row);
            } else {
                this.renderer.setBlock(null, i, row);
            }
        }
    }
    
    insertInRow (row: number, from: number, n: number) {
        const { columns } = this.renderer.getSize();

        for (let i = columns - 1; i >= from; i--) {
            if (i < from + n) {
                this.renderer.setBlock(null, i, row);
            } else {
                this.renderer.setBlock(this.renderer.getBlock(i - n, row), i, row);
            }
        }
    }

    cursorMove (n: number, action: string) {
        const { column, row } = this.renderer.getCursor();
        const { columns, rows } = this.renderer.getSize();

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
                const { top } = this.renderer.getScrollMargins();

                if (row == top) {
                    // scroll up
                    this.renderer.scroll(-1);
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

        for (let i = 0; i < text.length; i++) {
            if (text[i] == "\n") {
                this.newline();
            } else {
                const { column, row } = this.renderer.getCursor();

                this.renderer.printLetter(text[i], column, row);

                if (!this.renderer.isInRange(column + 1, row)) {
                    this.newline();
                } else {
                    this.renderer.setCursor(column + 1, row);
                }
            }
        }
    }

    static encodeRGB (r: number, g: number, b: number): string {
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    static parse8bitColor (n: number): Color {
        if (0 <= n && n <= 7) {
            // return the represented color directly
            return n as SGRColor;
        }
    
        if (8 <= n && n <= 15) {
            // TODO: support high intensity color
            return (n - 8) as SGRColor;
        }
    
        if (16 <= n && n <= 231) {
            // 6 × 6 × 6 cube (216 colors)
            // rgb is in base-6
            const rgb = n - 16;
            const r = Math.floor(255 / 5 * (rgb / 36));
            const gb = rgb % 36;
            const g = Math.floor(255 / 5 * gb / 6);
            const b = 255 / 5 * (gb % 6);
    
            return Terminal.encodeRGB(r, g, b);
        }
    
        if (232 <= n && n <= 255) {
            const grey = Math.round(255 / 23 * (n - 232));
            return Terminal.encodeRGB(grey, grey, grey);
        }
    
        assert(false, "n not in range [0, 256)");
        return "";
    }

    /**
     * Applies a sequence of SGR attributes to a block
     */
    static applySGRAttribute (attrs: Array<SGRAttribute>, block: Block): Block {
        let final = block.copy();

        const attributeHandlerMap: Record<number, () => void> = {
            [SGRAttribute.SGR_RESET]: () => final = new Block(),

            // intensity settings
            [SGRAttribute.SGR_HIGH_INTENSITY]:
                () => final.intensity = Intensity.SGR_INTENSITY_HIGH,

            [SGRAttribute.SGR_LOW_INTENSITY]:
                () => final.intensity = Intensity.SGR_INTENSITY_LOW,

            [SGRAttribute.SGR_NORMAL_INTENSITY]:
                () => final.intensity = Intensity.SGR_INTENSITY_NORMAL,

            // style settings
            [SGRAttribute.SGR_ITALIC_STYLE]:
                () => final.style = TextStyle.STYLE_ITALIC,

            [SGRAttribute.SGR_NORMAL_STYLE]:
                () => final.style = TextStyle.STYLE_NORMAL,

            // blink settings
            [SGRAttribute.SGR_SLOW_BLINK]:
                () => final.blink = BlinkStatus.BLINK_SLOW,

            [SGRAttribute.SGR_RAPID_BLINK]:
                () => final.blink = BlinkStatus.BLINK_FAST,

            [SGRAttribute.SGR_BLINK_OFF]:
                () => final.blink = BlinkStatus.BLINK_NONE,

            // reverse color (switch background & foreground)
            [SGRAttribute.SGR_REVERSE]:
                () => final.reversed = true,

            [SGRAttribute.SGR_REVERSE_OFF]:
                () => final.reversed = false,

            // foreground colors
            [SGRAttribute.SGR_FOREGROUND_BLACK]:
                () => final.foreground = SGRColor.SGR_COLOR_BLACK,

            [SGRAttribute.SGR_FOREGROUND_RED]:
                () => final.foreground = SGRColor.SGR_COLOR_RED,

            [SGRAttribute.SGR_FOREGROUND_GREEN]:
                () => final.foreground = SGRColor.SGR_COLOR_GREEN,

            [SGRAttribute.SGR_FOREGROUND_YELLOW]:
                () => final.foreground = SGRColor.SGR_COLOR_YELLOW,

            [SGRAttribute.SGR_FOREGROUND_BLUE]:
                () => final.foreground = SGRColor.SGR_COLOR_BLUE,
                
            [SGRAttribute.SGR_FOREGROUND_MAGENTA]:
                () => final.foreground = SGRColor.SGR_COLOR_MAGENTA,
                    
            [SGRAttribute.SGR_FOREGROUND_CYAN]:
                () => final.foreground = SGRColor.SGR_COLOR_CYAN,
                    
            [SGRAttribute.SGR_FOREGROUND_WHITE]:
                () => final.foreground = SGRColor.SGR_COLOR_WHITE,
                
            [SGRAttribute.SGR_FOREGROUND_DEFAULT]:
                () => final.foreground = SGRColor.SGR_COLOR_DEFAULT,
                
            // background colors
            [SGRAttribute.SGR_BACKGROUND_BLACK]:
                () => final.background = SGRColor.SGR_COLOR_BLACK,
                
            [SGRAttribute.SGR_BACKGROUND_RED]:
                () => final.background = SGRColor.SGR_COLOR_RED,
                
            [SGRAttribute.SGR_BACKGROUND_GREEN]:
                () => final.background = SGRColor.SGR_COLOR_GREEN,
                
            [SGRAttribute.SGR_BACKGROUND_YELLOW]:
                () => final.background = SGRColor.SGR_COLOR_YELLOW,
                
            [SGRAttribute.SGR_BACKGROUND_BLUE]:
                () => final.background = SGRColor.SGR_COLOR_BLUE,
                
            [SGRAttribute.SGR_BACKGROUND_MAGENTA]:
                () => final.background = SGRColor.SGR_COLOR_MAGENTA,
                
            [SGRAttribute.SGR_BACKGROUND_CYAN]:
                () => final.background = SGRColor.SGR_COLOR_CYAN,
                
            [SGRAttribute.SGR_BACKGROUND_WHITE]:
                () => final.background = SGRColor.SGR_COLOR_WHITE,
                
            [SGRAttribute.SGR_BACKGROUND_DEFAULT]:
                () => final.background = SGRColor.SGR_COLOR_DEFAULT,
        };

        for (let i = 0; i < attrs.length; i++) {
            const attr = attrs[i];

            switch (attr) {
                case SGRAttribute.SGR_FOREGROUND_CUSTOM:
                case SGRAttribute.SGR_BACKGROUND_CUSTOM: {
                    let color = null;

                    if (i + 1 < attrs.length) {
                        switch (attrs[i + 1]) {
                            case 2: // 2;r;g;b
                                if (i + 4 < attrs.length) {
                                    const [ r, g, b ] = attrs.slice(i + 2, i + 5);

                                    if (0 <= r && r < 256 &&
                                        0 <= g && g < 256 &&
                                        0 <= b && b < 256) {
                                        color = Terminal.encodeRGB(r, g, b);
                                        i += 4;
                                    }
                                }

                                break;

                            case 5: // 5;n https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit
                                if (i + 2 < attrs.length) {
                                    const n = attrs[i + 2];
                                    
                                    if (0 <= n && n < 256) {
                                        color = Terminal.parse8bitColor(n);
                                        i += 2;

                                        // console.log(`decoded 8-bit color: ${color}`);
                                    }
                                }

                                break;
                        }
                    }

                    if (color !== null) {
                        // console.log(`decoded color: ${color}`);

                        if (attr == SGRAttribute.SGR_FOREGROUND_CUSTOM) {
                            final.foreground = color;
                        } else {
                            final.background = color;
                        }

                        break;
                    }

                    console.log("ill formatted custom color rendition command");
                }

                default: {
                    const handler = attributeHandlerMap[attr];

                    if (typeof handler == "function") {
                        handler();
                    } else {
                        console.log(`SGR attribute ${attr} not implemented`);
                    }
                }
            }
        }

        return final;
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
            const { columns, rows } = this.renderer.getSize();
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
            const { columns } = this.renderer.getSize();

            if (code == 0) {
                this.eraseInRow(row, column, columns - 1);
            } else if (code == 1) {
                this.eraseInRow(row, 0, column);
            } else if (code == 2) {
                this.eraseInRow(row, 0, columns - 1);
            }
        });

        this.registerHandler("CONTROL_ERASE_CHAR", seq => {
            const [ n ] = seq.args;
            const { column, row } = this.renderer.getCursor();
            this.eraseInRow(row, column, column + n - 1);
        });

        this.registerHandler("CONTROL_INSERT_CHAR", seq => {
            const [ n ] = seq.args;
            const { column, row } = this.renderer.getCursor();
            this.insertInRow(row, column, n);
        });

        this.registerHandler("CONTROL_DELETE_CHAR", seq => {
            const [ n ] = seq.args;
            const { column, row } = this.renderer.getCursor();
            this.deleteInRow(row, column, n);
        });

        this.registerHandler("CONTROL_INSERT_LINE", seq => {
            const [ n ] = seq.args;
            const { row } = this.renderer.getCursor();
            this.renderer.scroll(-n, row);
        });

        this.registerHandler("CONTROL_DELETE_LINE", seq => {
            const [ n ] = seq.args;
            const { row } = this.renderer.getCursor();
            this.renderer.scroll(n, row);
        });

        this.registerHandler("CONTROL_GRAPHIC_RENDITION", seq => {
            const newDefault = Terminal.applySGRAttribute(seq.args, this.renderer.getDefaultBlock());
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
                        this.renderer.setSize(b, a);
                    }

                default:
                    console.log(`unknown window manipulation code ${code};${a};${b}`);
            }
        });

        this.registerHandler("CONTROL_SET_TOP_BOTTOM_MARGIN", seq => {
            let [ top, bottom ] = seq.args;
            const { rows } = this.renderer.getSize();

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

                this.renderer.setScrollMargins(top, bottom);
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
