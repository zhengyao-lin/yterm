import { assert } from "./utils";
import { UnicodeChar, unicodeLength } from "./unicode";

/**
 * Select graphic rendition codes
 * https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_parameters
 */
export enum SGRAttribute {
    SGR_RESET = 0,

    SGR_HIGH_INTENSITY = 1, // bold
    SGR_LOW_INTENSITY = 2, // faint
    SGR_NORMAL_INTENSITY = 22,
    
    SGR_ITALIC_STYLE = 3,
    SGR_FRAKTUR_STYLE = 20,
    SGR_NORMAL_STYLE = 23,

    SGR_UNDERLINE_ON = 4,
    SGR_DOUBLY_UNDERLINE = 21,
    SGR_UNDERLINE_OFF = 24,

    SGR_SLOW_BLINK = 5,
    SGR_RAPID_BLINK = 6,
    SGR_BLINK_OFF = 25,

    SGR_REVERSE = 7,
    SGR_REVERSE_OFF = 27,

    SGR_CONCEAL = 8,
    SGR_REVEAL = 28,

    SGR_CROSSED_OUT = 9,
    SGR_NOT_CROSSED_OUT = 29,
    
    SGR_DEFAULT_FONT = 10,
    SGR_ALTERNATIVE_FONT_1 = 11,
    SGR_ALTERNATIVE_FONT_2 = 12,
    SGR_ALTERNATIVE_FONT_3 = 13,
    SGR_ALTERNATIVE_FONT_4 = 14,
    SGR_ALTERNATIVE_FONT_5 = 15,
    SGR_ALTERNATIVE_FONT_6 = 16,
    SGR_ALTERNATIVE_FONT_7 = 17,
    SGR_ALTERNATIVE_FONT_8 = 18,
    SGR_ALTERNATIVE_FONT_9 = 19,

    SGR_FOREGROUND_BLACK = 30,
    SGR_FOREGROUND_RED = 31,
    SGR_FOREGROUND_GREEN = 32,
    SGR_FOREGROUND_YELLOW = 33,
    SGR_FOREGROUND_BLUE = 34,
    SGR_FOREGROUND_MAGENTA = 35,
    SGR_FOREGROUND_CYAN = 36,
    SGR_FOREGROUND_WHITE = 37,
    SGR_FOREGROUND_CUSTOM = 38,
    SGR_FOREGROUND_DEFAULT = 39,

    SGR_BACKGROUND_BLACK = 40,
    SGR_BACKGROUND_RED = 41,
    SGR_BACKGROUND_GREEN = 42,
    SGR_BACKGROUND_YELLOW = 43,
    SGR_BACKGROUND_BLUE = 44,
    SGR_BACKGROUND_MAGENTA = 45,
    SGR_BACKGROUND_CYAN = 46,
    SGR_BACKGROUND_WHITE = 47,
    SGR_BACKGROUND_CUSTOM = 48,
    SGR_BACKGROUND_DEFAULT = 49
}

export type Color = SGRColor | string;

export enum SGRColor {
    SGR_COLOR_BLACK = 0,
    SGR_COLOR_RED,
    SGR_COLOR_GREEN,
    SGR_COLOR_YELLOW,
    SGR_COLOR_BLUE,
    SGR_COLOR_MAGENTA,
    SGR_COLOR_CYAN,
    SGR_COLOR_WHITE,
    SGR_COLOR_DEFAULT
}

export enum Intensity {
    SGR_INTENSITY_NORMAL,
    SGR_INTENSITY_HIGH,
    SGR_INTENSITY_LOW
}

export enum BlinkStatus {
    BLINK_NONE,
    BLINK_SLOW,
    BLINK_FAST
}

export enum TextStyle {
    STYLE_NORMAL,
    STYLE_ITALIC
}

/**
 * Class representing a single cell in the terminal screen
 * containing all relevant data for rendering
 */
export class Block {
    private char: UnicodeChar | null;
    
    public background: Color;
    public foreground: Color;
    public intensity: Intensity;
    public blink: BlinkStatus;
    public reversed: boolean;
    public style: TextStyle;

    constructor (char = null,
                 background = SGRColor.SGR_COLOR_DEFAULT,
                 foreground = SGRColor.SGR_COLOR_DEFAULT) {
        assert(char == null || unicodeLength(char!) == 1, `${char} is not a single character`);

        this.char = char;

        this.background = background;
        this.foreground = foreground;

        this.intensity = Intensity.SGR_INTENSITY_NORMAL;
        this.blink = BlinkStatus.BLINK_NONE;
        this.reversed = false;
        this.style = TextStyle.STYLE_NORMAL;
    }

    copy (): Block {
        return Object.create(this);
    }

    getChar () { return this.char; }

    withChar (char: UnicodeChar | null) {
        const copy = this.copy();
        copy.char = char;
        return copy;
    }
}

/**
 * Screen buffer keeps in track of
 *   1. characters on the screen
 *   2. cursor position
 *   3. scroll margins
 */
export class ScreenBuffer {
    private columns: number;
    private rows: number;
    private screen: Array<Array<Block | null>>;

    private cursorColumn: number;
    private cursorRow: number;

    private scrollTopMargin: number;
    private scrollBottomMargin: number;

    constructor (columns: number, rows: number) {
        assert(columns > 0 && rows > 0, "non-positive column or row number");

        this.columns = columns;
        this.rows = rows;
        this.screen = new Array<Array<Block | null>>(rows);

        for (let row = 0; row < rows; row++) {
            this.screen[row] = new Array<Block | null>(columns);
        }

        this.cursorColumn = 0;
        this.cursorRow = 0;

        this.scrollTopMargin = 0;
        this.scrollBottomMargin = this.rows - 1;
    }

    getSize (): { columns: number, rows: number } {
        return {
            columns: this.columns,
            rows: this.rows
        };
    }

    isInRange (column: number, row: number): boolean {
        return column >= 0 && column < this.columns &&
               row >= 0 && row < this.rows;
    }

    assertInRange (column: number, row: number) {
        assert(this.isInRange(column, row), `position (${column}, ${row}) is not in range`);
    }

    getBlock (column: number, row: number): Block | null {
        this.assertInRange(column, row);

        // change undefined to null
        if (this.screen[row][column] === undefined) return null;
        
        return this.screen[row][column];
    }

    setBlock (block: Block | null, column: number, row: number) {
        this.assertInRange(column, row);
        this.screen[row][column] = block;
    }

    getCursor (): { column: number, row: number } {
        return {
            column: this.cursorColumn,
            row: this.cursorRow
        };
    }

    setCursor (column: number, row: number) {
        this.assertInRange(column, row);
        this.cursorColumn = column;
        this.cursorRow = row;
    }

    setScrollMargins (top: number, bottom: number) {
        this.scrollTopMargin = top;
        this.scrollBottomMargin = bottom;
    }

    getScrollMargins (): { top: number, bottom: number } {
        return {
            top: this.scrollTopMargin,
            bottom: this.scrollBottomMargin
        }
    }

    /**
     * Resize the buffer and adjust the cursor position
     */
    resize (columns: number, rows: number) {
        assert(columns > 0 && rows > 0, "non-positive column or row number");

        const newScreen = new Array<Array<Block | null>>(rows);

        for (let row = 0; row < rows; row++) {
            newScreen[row] = new Array<Block | null>(columns);
        }

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
                if (this.isInRange(j, i)) {
                    newScreen[i][j] = this.screen[i][j];
                }
            }
        }

        // adjust cursor position
        if (this.cursorColumn >= columns) {
            this.cursorColumn = columns - 1;
        }

        if (this.cursorRow >= rows) {
            this.cursorRow = rows - 1;
        }

        this.screen = newScreen;

        this.scrollTopMargin = 0;
        this.scrollBottomMargin = this.columns;
    }

    /**
     * Scroll the screen up or down in the given scroll window ([margin top, margin bottom])
     * (similar to the definition here https://vt100.net/docs/vt100-ug/chapter3.html#DECSTBM)
     * @param {number} n integers; positive for scrolling down; negative for scrolling up
     */
    scroll (n: number, scrollTopMargin = this.scrollTopMargin, scrollBottomMargin = this.scrollBottomMargin) {
        this.assertInRange(0, scrollTopMargin);
        this.assertInRange(0, scrollBottomMargin);

        let scrollUp = false;
        const scrollWindowRows = scrollBottomMargin - scrollTopMargin + 1;

        if (n == 0) return;

        if (n < 0) {
            n = -n;
            scrollUp = true;
        }

        if (n > scrollWindowRows) {
            n = scrollWindowRows;
        }

        if (scrollUp) {
            // remove the last n rows and insert n new ones in the front
            this.screen.splice(scrollBottomMargin + 1 - n, n);

            let prepend = new Array<Array<Block | null>>();

            for (let i = 0; i < n; i++) {
                prepend.push(new Array(this.columns));
            }

            this.screen.splice(scrollTopMargin, 0, ...prepend);
        } else {
            // remove the first n rows and insert n new ones in the back
            this.screen.splice(scrollTopMargin, n);

            for (let i = 0; i < n; i++) {
                this.screen.splice(scrollBottomMargin, 0, new Array(this.columns));
            }
        }
    }
};

/**
 * Base class for a renderer device
 * This is implemented by CanvasRenderer and TestRenderer
 */
export class Renderer {
    static DEFAULT_COLUMNS = 80;
    static DEFAULT_ROWS = 24;
    static DEFAULT_BLOCK = new Block();

    private currentScreen: ScreenBuffer;
    private mainScreen: ScreenBuffer | null;

    private defaultBlock: Block; // default block is equivalent to a null block

    constructor (columns = Renderer.DEFAULT_COLUMNS,
                 rows = Renderer.DEFAULT_ROWS,
                 defaultBlock = Renderer.DEFAULT_BLOCK) {
        this.currentScreen = new ScreenBuffer(columns, rows);
        this.mainScreen = null;

        this.defaultBlock = defaultBlock;
    }

    setBlock (block: Block | null, column: number, row: number): void {
        this.assertInRange(column, row);
        this.currentScreen.setBlock(block, column, row);
    }
    
    getBlock (column: number, row: number): Block | null {
        this.assertInRange(column, row);
        return this.currentScreen.getBlock(column, row);
    }

    /**
     * setCursor should follow the following convention:
     * if the position (column, row) exceeds the range
     * setCursor will replace it with the nearest position in range
     */
    setCursor (column: number, row: number) {
        const { columns, rows } = this.currentScreen.getSize();

        if (column < 0) {
            column = 0;
        }

        if (column >= columns) {
            column = columns - 1;
        }

        if (row < 0) {
            row = 0;
        }

        if (row >= rows) {
            row = rows - 1;
        }
         
        this.currentScreen.setCursor(column, row);
    }
    
    getCursor (): { column: number, row: number } {
        return this.currentScreen.getCursor();
    }

    setScrollMargins (top: number, bottom: number) {
        this.currentScreen.setScrollMargins(top, bottom);
    }

    getScrollMargins (): { top: number, bottom: number } {
        return this.currentScreen.getScrollMargins();
    }
    
    useAlternativeScreen () {
        const { columns, rows } = this.currentScreen.getSize();
        
        if (this.mainScreen === null) {
            // currently on the main screen
            this.mainScreen = this.currentScreen;
            this.currentScreen = new ScreenBuffer(columns, rows);
        } else {
            // already on an alternative screen
            this.currentScreen = new ScreenBuffer(columns, rows);
        }

        const { column, row } = this.mainScreen.getCursor();
        this.currentScreen.setCursor(column, row);
    }

    useMainScreen () {
        if (this.mainScreen !== null) {
            this.currentScreen = this.mainScreen;
            this.mainScreen = null;
        }
    }

    /** Other utility methods based on the abstract methods above */
    setSize (columns: number, rows: number) {
        this.currentScreen.resize(columns, rows);
        
        if (this.mainScreen !== null) {
            this.mainScreen.resize(columns, rows);
        }
    }

    getSize (): { columns: number, rows: number } {
        return this.currentScreen.getSize();
    }

    setDefaultBlock (block: Block) {
        this.defaultBlock = block;
    }

    getDefaultBlock (): Block {
        return this.defaultBlock;
    }

    isInRange (column: number, row: number): boolean {
        return this.currentScreen.isInRange(column, row);

    }

    assertInRange (column: number, row: number) {
        return this.currentScreen.assertInRange(column, row);
    }

    printLetter (letter: UnicodeChar | null, column: number, row: number) {
        if (letter === null) {
            this.setBlock(null, column, row);
        } else {
            this.setBlock(this.defaultBlock.withChar(letter), column, row);
        }
    }

    scroll (n: number, ...args: any) {
        this.currentScreen.scroll(n, ...args);
    }

    /* Optional methods */
    showCursor () {}
    hideCursor () {}
    enableCursorBlink () {}
    disableCursorBlink () {}
}
