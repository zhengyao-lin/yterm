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
 * Abstract class for a renderer device
 * This is implemented by CanvasRenderer and TestRenderer
 */
export abstract class Renderer {
    static DEFAULT_COLUMNS = 80;
    static DEFAULT_ROWS = 24;
    static DEFAULT_BLOCK = new Block();

    protected columns: number;
    protected rows: number;

    private defaultBlock: Block; // default block is equivalent to a null block

    constructor (columns = Renderer.DEFAULT_COLUMNS,
                 rows = Renderer.DEFAULT_ROWS,
                 defaultBlock = Renderer.DEFAULT_BLOCK) {
        this.columns = columns;
        this.rows = rows;

        this.defaultBlock = defaultBlock;
    }

    /** The minimum set of interfaces required */

    abstract setBlock (block: Block | null, column: number, row: number): void;
    abstract getBlock (column: number, row: number): Block | null;

    /**
     * setCursor should follow the following convention:
     * if the position (column, row) exceeds the range
     * setCursor will replace it with the nearest position in range
     */
    abstract setCursor (column: number, row: number): void;
    abstract getCursor (): { column: number, row: number };

    /* Optional methods */
    showCursor () {}
    hideCursor () {}
    enableCursorBlink () {}
    disableCursorBlink () {}

    useAlternativeScreen () {}
    useMainScreen () {}

    /** Other utility methods based on the abstract methods above */
    setGridSize (columns: number, rows: number) {
        this.columns = columns;
        this.rows = rows;
    }

    getGridSize (): { columns: number, rows: number } {
        return {
            columns: this.columns,
            rows: this.rows
        }
    }

    setDefaultBlock (block: Block) {
        this.defaultBlock = block;
    }

    getDefaultBlock (): Block {
        return this.defaultBlock;
    }

    isInRange (column: number, row: number): boolean {
        const { columns, rows } = this.getGridSize();
        return column >= 0 && column < columns && row >= 0 && row < rows;
    }

    assertIndexInRange (column: number, row: number) {
        assert(this.isInRange(column, row), `position (${column}, ${row}) out of bounds`);
    }

    printLetter (letter: UnicodeChar | null, column: number, row: number) {
        if (letter === null) {
            this.setBlock(null, column, row);
        } else {
            this.setBlock(this.defaultBlock.withChar(letter), column, row);
        }
    }

    sanitizeScrollArguments (
        n: number,
        scrollMarginTop: number,
        scrollMarginBottom: number
    ): {
        n: number,
        scrollUp: boolean,
        scrollMarginTop: number,
        scrollMarginBottom: number
    } {
        this.assertIndexInRange(0, scrollMarginTop);
        this.assertIndexInRange(0, scrollMarginBottom);

        let scrollUp = false;
        const scrollWindowRows = scrollMarginBottom - scrollMarginTop + 1;

        if (n < 0) {
            n = -n;
            scrollUp = true;
        }

        if (n > scrollWindowRows) {
            n = scrollWindowRows;
        }

        return {
            n: n,
            scrollUp: scrollUp,
            scrollMarginTop: scrollMarginTop,
            scrollMarginBottom: scrollMarginBottom
        }
    }

    /**
     * Scroll the screen up or down in the given scroll window ([margin top, margin bottom])
     * (similar to the definition here https://vt100.net/docs/vt100-ug/chapter3.html#DECSTBM)
     * @param {number} n integers; positive for scrolling down; negative for scrolling up
     */
    scroll (_n: number, _scrollMarginTop = 0, _scrollMarginBottom = this.rows - 1) {
        const { columns } = this.getGridSize();
        const {
            n,
            scrollUp,
            scrollMarginTop,
            scrollMarginBottom
        } = this.sanitizeScrollArguments(_n, _scrollMarginTop, _scrollMarginBottom);

        if (n == 0) return;
    
        if (scrollUp) {
            for (let i = scrollMarginBottom; i >= scrollMarginTop; i--) {
                for (let j = 0; j < columns; j++) {
                    if (i < scrollMarginTop + n) {
                        // clear the first n rows
                        this.setBlock(null, j, i);
                    } else {
                        // move first n rows down by n
                        this.setBlock(this.getBlock(j, i - n), j, i);
                    }
                }
            }
        } else {
            for (let i = scrollMarginTop; i <= scrollMarginBottom; i++) {
                for (let j = 0; j < columns; j++) {
                    if (i <= scrollMarginBottom - n) {
                        // move first (rows - n) rows up by n
                        this.setBlock(this.getBlock(j, i + n), j, i);
                    } else {
                        // clear the rest
                        this.setBlock(null, j, i);
                    }
                }
            }
        }
    }

    /**
     * Remove `n` lines in the end and insert `n` empty lines at `row`
     */
    insertLine (row: number, n: number) {
        assert(n >= 0, "inserting a negative number of lines");
        this.scroll(-n, row);
    }

    /**
     * Delete `n` lines at `row` add `n` empty lines in the end
     */
    deleteLine (row: number, n: number) {
        assert(n >= 0, "deleting a negative number of lines");
        this.scroll(n, row);
    }
}

function encodeRGB (r: number, g: number, b: number): string {
    // return "#" + ((r << 16) + (g << 8) + b).toString(16);
    return `rgb(${r}, ${g}, ${b})`;
}

function parse8bitColor (n: number): Color {
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

        return encodeRGB(r, g, b);
    }

    if (232 <= n && n <= 255) {
        const grey = Math.round(255 / 23 * (n - 232));
        return encodeRGB(grey, grey, grey);
    }

    assert(false, "n not in range [0, 256)");
    return "";
}

/**
 * Applies a sequence of SGR attributes to a block
 */
export function applySGRAttribute (attrs: Array<SGRAttribute>, block: Block): Block {
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
                                    color = encodeRGB(r, g, b);
                                    i += 4;
                                }
                            }

                            break;

                        case 5: // 5;n https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit
                            if (i + 2 < attrs.length) {
                                const n = attrs[i + 2];
                                
                                if (0 <= n && n < 256) {
                                    color = parse8bitColor(n);
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
