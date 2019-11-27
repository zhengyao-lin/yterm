import { regexUnion, regexMatchStart } from "./utils";

/**
 * Class representing a control sequence
 */
export class ControlSequence {
    public cmd: string;
    public args: Array<any>;

    constructor (cmd: string, args: Array<any>) {
        this.cmd = cmd;
        this.args = args;
    }

    toString (): string {
        return `control ${this.cmd} (${this.args.join(", ")})`;
    }
}

/**
 * Definition (pattern) and handler of a control sequence
 */
export class ControlDefinition {
    public pattern: RegExp;
    public patternMatchStart: RegExp;

    public handler: (match: RegExpExecArray) => ControlSequence;

    constructor (pattern: RegExp, handler: (match: RegExpExecArray) => ControlSequence) {
        this.pattern = pattern;
        this.patternMatchStart = regexMatchStart(pattern);
        this.handler = handler;
    }
}

/**
 * The set of ANSI escape sequences currently supported.
 * Some of them are actually not standard ANSI sequences but rather widely-used extensions.
 * References can be found in these web pages:
 *   1. https://docs.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences
 *   2. https://vt100.net/docs/vt510-rm/contents.html
 */
export const ansiControlSequences = [
    /**
     * OSC operating system commands
     * ESC ] <n> ; <string> BEL
     * 
     * For n = 0, the sequence is used for changing the title
     */
    new ControlDefinition(/\x1b](\d+);([^\x1b\x07]+)\x07/, match => {
        return new ControlSequence("CONTROL_OS_CONTROL", [parseInt(match[1]), match[2]]);
    }),

    /**
     * Curosr positioning sequences
     * https://docs.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences#simple-cursor-positioning
     * https://docs.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences#cursor-positioning
     */

    /**
     * A - cursor up by n
     * B - cursor down by n
     * C - cursor forward (right) by n
     * D - cursor backward (left) by n
     * H - home position (TODO: check)
     * F - end position (TODO: check)
     * G or ` - horizontal absolute positioning
     * d - vertical absolute positioning
     */
    new ControlDefinition(/\x1b\[(\d*)(A|B|C|D|H|F|G|`|d)/, match => {
        return new ControlSequence("CONTROL_CURSOR_MOVE", [parseInt(match[1] || "1"), match[2]]);
    }),

    /**
     * Same as the counterparts for ESC [ A/B/C/D but default to 1 unit
     * ESC M is reverse index:
     *   Performs the reverse operation of \n, moves cursor up one line, maintains horizontal position, scrolls buffer if necessary
     *   (https://docs.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences#simple-cursor-positioning)
     */
    new ControlDefinition(/\x1b(A|B|C|D|M)/, match => {
        return new ControlSequence("CONTROL_CURSOR_MOVE", [1, match[1]]);
    }),

    /**
     * Direct cursor positioning
     * ESC [ <y> ; <x> H - CUP
     * ESC [ <y> ; <x> f - HVP
     * These two are the same but HVP is only here for compatibility (https://vt100.net/docs/vt510-rm/HVP.html)
     */
    new ControlDefinition(/\x1b\[(\d+);(\d+)(H|f)/, match => {
        return new ControlSequence("CONTROL_CURSOR_MOVE_DIRECT", [parseInt(match[1]), parseInt(match[2])]);
    }),

    /**
     * Save and restore cursor position (only have a buffer of size 1)
     */
    new ControlDefinition(/\x1b7/, _ => {
        return new ControlSequence("CONTROL_SAVE_CURSOR", []);
    }),

    new ControlDefinition(/\x1b8/, _ => {
        return new ControlSequence("CONTROL_RESTORE_CURSOR", []);
    }),

    /**
     * Select graph rendition
     * https://docs.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences#text-formatting
     * 
     * This is a family of text formatting sequences
     * ESC [ <n>; <n>; ... m
     * Each command <n> is applied to the current context in sequence
     * See SGRAttribute enum for supported commands
     */
    new ControlDefinition(/\x1b\[((\d+)?(;(\d+)?)*)m/, match => {
        const modes = match[1].split(";");
        const args = [];

        for (const mode of modes) {
            if (mode === "") {
                args.push(0);
            } else {
                args.push(parseInt(mode));
            }
        }
    
        return new ControlSequence("CONTROL_GRAPHIC_RENDITION", args);
    }),

    /**
     * Text modification sequences
     * https://docs.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences#text-modification
     */
    new ControlDefinition(/\x1b\[(\d*)P/, match => {
        return new ControlSequence("CONTROL_DELETE_CHAR", [parseInt(match[1] || "1")]);
    }),

    new ControlDefinition(/\x1b\[(\d*)L/, match => {
        return new ControlSequence("CONTROL_INSERT_LINE", [parseInt(match[1] || "1")]);
    }),

    new ControlDefinition(/\x1b\[(\d*)@/, match => {
        return new ControlSequence("CONTROL_INSERT_CHAR", [parseInt(match[1] || "1")]);
    }),

    new ControlDefinition(/\x1b\[(\d*)M/, match => {
        return new ControlSequence("CONTROL_DELETE_LINE", [parseInt(match[1] || "1")]);
    }),

    /**
     * The integer parameter for the following two sequences are
     *   n = 0 erases from the current cursor position (inclusive) to the end of the line/display
     *   n = 1 erases from the beginning of the line/display up to and including the current cursor position
     *   n = 2 erases the entire line/display
     * Reference https://docs.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences#text-modification
     */
    new ControlDefinition(/\x1b\[(\d?)K/, match => {
        return new ControlSequence("CONTROL_ERASE_IN_LINE", [parseInt(match[1] || "0")]);
    }),

    new ControlDefinition(/\x1b\[(\d?)J/, match => {
        return new ControlSequence("CONTROL_ERASE_IN_DISPLAY", [parseInt(match[1] || "0")]);
    }),

    /**
     * Designate character set
     * https://docs.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences#designate-character-set
     * 
     * The default mode is the ascii mode.
     * The DEC line drawing mode (TODO: support this) can be used to draw certain border characters,
     * see the table in the link above
     */
    new ControlDefinition(/\x1b\(B/, _ => {
        return new ControlSequence("CONTROL_ASCII_MODE", []);
    }),

    new ControlDefinition(/\x1b\(0/, _ => {
        return new ControlSequence("CONTROL_DEC_LINE_DRAWING_MODE", []);
    }),


    /**
     * Input mode changes
     * https://docs.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences#mode-changes
     * 
     * ^
     * | There are two different sets of input modes, the Cursor Keys Mode and the Keypad Keys Mode.
     * | The Cursor Keys Mode controls the sequences that are emitted by the arrow keys as well as Home and End,
     * | while the Keypad Keys Mode controls the sequences emitted by the keys on the numpad primarily, as well as the function keys.
     * 
     * ESC =   Keypad keys will emit their Application Mode sequences
     * ESC >   Keypad keys will emit their Numeric Mode sequences
     * 
     * ESC [ ?1 h  Cursor keys will emit their Application Mode sequences
     * ESC [ ?1 l  Cursor keys will emit their Numeric Mode sequences
     * 
     * See https://docs.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences#cursor-keys
     * for the changes required
     */
    new ControlDefinition(/\x1b=/, _ => {
        return new ControlSequence("CONTROL_ENABLE_KEYPAD_APP_MODE", []);
    }),

    new ControlDefinition(/\x1b>/, _ => {
        return new ControlSequence("CONTROL_ENABLE_KEYPAD_NUM_MODE", []);
    }),

    /** h for high and l for low */
    new ControlDefinition(/\x1b\[(\??\d+)(h|l)/, match => {
        return new ControlSequence("CONTROL_SET_RESET_MODE", [match[1], match[2]]);
    }),

    /**
     * Set (vertical) scroll margin
     * https://docs.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences#scrolling-margins
     * 
     * Not supported currently
     */
    new ControlDefinition(/\x1b\[(\d*)(;(\d*))?r/, match => {
        return new ControlSequence("CONTROL_SET_TOP_BOTTOM_MARGIN", [parseInt(match[1] || "1"), parseInt(match[3] || "-1")]);
    }),

    /**
     * Slightly uncommon seuqneces for window manipulation
     * In particular, ESC [ 8 ; <h>> ; <w> t can be used to change window size
     */
    new ControlDefinition(/\x1b\[(\d*);(\d*);(\d*)t/, match => {
        return new ControlSequence("CONTROL_WINDOW_MANIPULATION", [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]);
    }),

    /**
     * "Outputs a string directly to the host terminal without interpretation"
     * https://www.gnu.org/software/screen/manual/html_node/Control-Sequences.html
     */
    new ControlDefinition(/\x1bP([^\x1b]*)\x1b\\/, match => {
        return new ControlSequence("CONTROL_DEVICE_CONTROL_STRING", [match[1]]);
    }),

    // Report cursor position
    // https://docs.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences#query-state
    new ControlDefinition(/\x1b\[6n/, _ => {
        return new ControlSequence("CONTROL_REPORT_CURSOR", []);
    }),

    /**
     * Device Attributes
     * 
     * There are three types of attributes (these are from vt510)
     * https://vt100.net/docs/vt510-rm/DA1.html
     * https://vt100.net/docs/vt510-rm/DA2.html
     * https://vt100.net/docs/vt510-rm/DA3.html
     */
    new ControlDefinition(/\x1b\[0?c/, _ => {
        return new ControlSequence("CONTROL_PRIMARY_DEVICE_ATTR", []);
    }),

    new ControlDefinition(/\x1b\[>0?c/, _ => {
        return new ControlSequence("CONTROL_SECONDARY_DEVICE_ATTR", []);
    }),

    new ControlDefinition(/\x1b\[=0?c/, _ => {
        return new ControlSequence("CONTROL_TERTIARY_DEVICE_ATTR", []);
    }),
];

export const asciiControlSequences = [
    new ControlDefinition(/\x07/, () => {
        return new ControlSequence("CONTROL_BELL", []);
    }),

    new ControlDefinition(/\x08/, () => {
        return new ControlSequence("CONTROL_BACKSPACE", []);
    }),

    new ControlDefinition(/\x09/, () => {
        return new ControlSequence("CONTROL_TAB", []);
    }),

    new ControlDefinition(/\x0d/, () => {
        return new ControlSequence("CONTROL_CARRIAGE_RETURN", []);
    })
];

/**
 * Class for parsing source input
 */
export class ControlSequenceParser {
    /**
     * Wait for the next chunk if there is a escape char within this distance to the end of the buffer
     */
    static MIN_ESCAPE_WAIT_LENGTH = 10;

    private defs: Array<ControlDefinition>;
    private unionPattern: RegExp;
    private handlers: Array<(chunk: ControlSequence | string) => void>;

    private buffer: string;

    constructor (defs: Array<ControlDefinition>) {
        this.defs = defs;
        this.unionPattern = regexUnion(...defs.map(d => d.pattern)); // union pattern for fast screening
        this.handlers = [];
        this.buffer = "";
    }

    /**
     * Register event handler upon decoding a chunk
     */
    onChunk (handler: (chunk: ControlSequence | string) => void) {
        this.handlers.push(handler);
    }

    /**
     * Push new data onto the buffer
     */
    pushData (data: string) {
        this.buffer += data;
        this.buffer = this.parserData(this.buffer);
    }

    private callHandler (chunk: ControlSequence | string) {
        for (const handler of this.handlers) {
            handler(chunk);
        }
    }

    /**
     * Parse a stream of data as chunks of raw strings (that are going to be printed directly)
     * and escaped sequences
     * 
     * Returns the number of bytes parsed
     */
    private parserData (data: string): string {
        const originalLength = data.length;

        while (data.length) {
            const pos = data.search(this.unionPattern);

            if (pos == -1) {
                // no match but we still need to consider the
                // case where sequences are broken up in different chunks
                
                // heuristic: try to find the escape character
                // if found and it's very close to the end
                // flush the previous part and wait for the next chunk of data

                const escPos = data.lastIndexOf("\x1b");
                
                if (escPos != -1 &&
                    data.length - escPos <= ControlSequenceParser.MIN_ESCAPE_WAIT_LENGTH) {
                    this.callHandler(data.substring(0, escPos));
                    data = data.substring(escPos);
                } else {
                    // nevermind
                    this.callHandler(data);
                    data = ""; // nothing left
                }
            
                break;
            }

            if (pos) {
                this.callHandler(data.substring(0, pos));
            }
            
            data = data.substring(pos);

            // otherwise check every possible sequence
            for (const def of this.defs) {
                const match = def.patternMatchStart.exec(data);

                if (match !== null) {
                    this.callHandler(def.handler(match));
                    data = data.substring(match[0].length);
                    break;
                }
            }

            // there should be at least one match,
            // otherwise unionRegex is not working correctly
        }

        return data;
    }
}

/**
 * Full parser of all currently supported control sequences
 */
export const fullParser = new ControlSequenceParser(ansiControlSequences.concat(asciiControlSequences));
