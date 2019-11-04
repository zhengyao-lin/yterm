import { assert } from "./utils";
import { UnicodeChar, unicodeLength } from "./unicode";

export class Font {
    private family: string;
    private size: number;

    constructor (family: string, size: number) {
        this.family = family;
        this.size = size;
    }

    getFamily () { return this.family; }
    getSize () { return this.size; }

    static defaultFont(): Font {
        return new Font("Ubuntu Mono", 16);
    }
}

export type Color = string;

// block represents a single character block on the terminal
// containing all style related data
export class Block {
    private background: Color;
    private foreground: Color;
    private char: UnicodeChar | null;
    
    constructor (background: Color, foreground: Color, char?: UnicodeChar) {
        assert(char == null || unicodeLength(char) == 1, `${char} is not a single character`);

        this.background = background;
        this.foreground = foreground;
        this.char = char;
    }

    getBackground () { return this.background; }
    getForeground () { return this.foreground; }
    getChar () { return this.char; }
}

export interface Renderer {}
