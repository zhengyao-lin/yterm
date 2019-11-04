import { assert } from "./utils";
import { UnicodeChar, unicodeLength } from "./unicode";

export type Color = string;

// block represents a single character block on the terminal
// containing all style related data
export class Block {
    private background: Color;
    private foreground: Color;
    private char: UnicodeChar | null;
    
    constructor (background: Color, foreground: Color, char: UnicodeChar | null) {
        assert(char == null || unicodeLength(char) == 1, `${char} is not a single character`);

        this.background = background;
        this.foreground = foreground;
        this.char = char;
    }

    getBackground () { return this.background; }
    getForeground () { return this.foreground; }
    getChar () { return this.char; }

    withChar (char: UnicodeChar | null) {
        return new Block(this.background, this.foreground, char);
    }
}

export abstract class Renderer {
    private defaultBlock: Block; // default block is equivalent to a null block

    constructor (defaultBlock = new Block("#000", "#fff", null)) {
        this.defaultBlock = defaultBlock;
    }

    // minimum set of interface
    abstract setGridSize (columns: number, rows: number): void;

    // behaviour of changing the grid size is implementation dependent
    abstract getGridSize (): { columns: number, rows: number };

    abstract setBlock (block: Block | null, column: number, row: number): void;
    abstract getBlock (column: number, row: number): Block | null;

    abstract setCursor (column: number, row: number): void;
    abstract getCursor (): { column: number, row: number };

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

    // overwriting scrollDown may be more efficient
    scrollDown (n: number): void {
        assert(n >= 0, "scrolling down by a negative number");

        const { columns, rows } = this.getGridSize();

        if (n == 0) {
            return;
        }

        if (n > rows) {
            n = rows;
        }

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
                if (i < rows - n) {
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
