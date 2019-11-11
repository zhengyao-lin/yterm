import { regexUnion, regexMatchStart } from "./utils";

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

export const ansiControlSequences = [
    // operating system controls
    new ControlDefinition(/\x1b](\d+);([^\x1b\x07]+)\x07/, match => {
        return new ControlSequence("CONTROL_OS_CONTROL", [parseInt(match[1]), match[2]]);
    }),

    new ControlDefinition(/\x1b\[(\d*)(A|B|C|D|H|F)/, match => {
        return new ControlSequence("CONTROL_CURSOR_MOVE", [parseInt(match[1] || "1"), match[2]]);
    }),

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

    new ControlDefinition(/\x1b\[(\d?)K/, match => {
        return new ControlSequence("CONTROL_ERASE_IN_LINE", [parseInt(match[1] || "0")]);
    }),

    new ControlDefinition(/\x1b\[(\d*)P/, match => {
        return new ControlSequence("CONTROL_DELETE_CHAR", [parseInt(match[1] || "1")]);
    }),

    new ControlDefinition(/\x1b\[(\d*)L/, match => {
        return new ControlSequence("CONTROL_INSERT_LINE", [parseInt(match[1] || "1")]);
    }),

    new ControlDefinition(/\x1b\[(\d*)@/, match => {
        return new ControlSequence("CONTROL_INSERT_CHAR", [parseInt(match[1] || "1")]);
    }),

    // direct cursor addressing
    new ControlDefinition(/\x1b\[(\d+);(\d+)(H|f)/, match => {
        return new ControlSequence("CONTROL_CURSOR_MOVE_DIRECT", [parseInt(match[1]), parseInt(match[2])]);
    }),

    new ControlDefinition(/\x1b\[(\d+)(G|`)/, match => {
        return new ControlSequence("CONTROL_CURSOR_HORIZONTAL_POS", [parseInt(match[1])]);
    }),

    new ControlDefinition(/\x1b\[(\d+)d/, match => {
        return new ControlSequence("CONTROL_CURSOR_VERTICAL_POS", [parseInt(match[1])]);
    }),

    new ControlDefinition(/\x1b\(B/, _ => {
        return new ControlSequence("CONTROL_ASCII_MODE", []);
    }),

    // TODO: might be interesting to look into this one
    new ControlDefinition(/\x1b\(0/, _ => {
        return new ControlSequence("CONTROL_DEC_LINE_DRAWING_MODE", []);
    }),

    new ControlDefinition(/\x1b\[(\d?)J/, match => {
        return new ControlSequence("CONTROL_ERASE_IN_DISPLAY", [parseInt(match[1] || "0")]);
    }),

    // TODO: what do these control sequences do
    new ControlDefinition(/\x1b=/, _ => {
        return new ControlSequence("CONTROL_ENABLE_KEYPAD_APP_MODE", []);
    }),

    new ControlDefinition(/\x1b>/, _ => {
        return new ControlSequence("CONTROL_ENABLE_KEYPAD_NUM_MODE", []);
    }),

    new ControlDefinition(/\x1b\[(\??\d+)(h|l)/, match => {
        return new ControlSequence("CONTROL_SET_RESET_MODE", [match[1], match[2]]);
    }),

    new ControlDefinition(/\x1b\[(\d*);(\d*)r/, match => {
        return new ControlSequence("CONTROL_SET_TOP_BOTTOM_MARGIN", [parseInt(match[1] || "0"), parseInt(match[2] || "0")]);
    }),

    new ControlDefinition(/\x1b\[(\d*);(\d*);(\d*)t/, match => {
        return new ControlSequence("CONTROL_WINDOW_MANIPULATION", [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]);
    }),

    new ControlDefinition(/\x1b\[>c/, _ => {
        return new ControlSequence("CONTROL_SEND_DEVICE_ATTR", []);
    }),

    new ControlDefinition(/\x1bP([^\x1b]*)\x1b\\/, match => {
        return new ControlSequence("CONTROL_DEVICE_CONTROL_STRING", [match[1]]);
    }),

    new ControlDefinition(/\x1b7/, _ => {
        return new ControlSequence("CONTROL_SAVE_CURSOR", []);
    }),

    new ControlDefinition(/\x1b8/, _ => {
        return new ControlSequence("CONTROL_RESTORE_CURSOR", []);
    }),

    // move cursor up by one row. if the cursor is at the top
    // scroll up
    new ControlDefinition(/\x1bM/, _ => {
        return new ControlSequence("CONTROL_REVERSE_INDEX", []);
    })
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

export class ControlSequenceParser {
    private defs: Array<ControlDefinition>;
    private unionPattern: RegExp;

    constructor (defs: Array<ControlDefinition>) {
        this.defs = defs;
        this.unionPattern = regexUnion(...defs.map(d => d.pattern)); // union pattern for fast screening
    }

    // TODO: do we need to deal with sequences that are broken up in two chunks of data?
    parseStream (data: string, handler: (chunk: ControlSequence | string) => void) {
        while (data.length) {
            const pos = data.search(this.unionPattern);

            if (pos == -1) {
                handler(data);
                break;
            }

            if (pos) {
                handler(data.substring(0, pos));
            }
            
            data = data.substring(pos);

            // otherwise check every possible sequence
            for (const def of this.defs) {
                const match = def.patternMatchStart.exec(data);

                if (match !== null) {
                    handler(def.handler(match));
                    data = data.substring(match[0].length);
                    break;
                }
            }

            // there should be at least one match,
            // otherwise unionRegex is not working correctly
        }
    }
}

// containing all sequences currently supporting
export const fullParser = new ControlSequenceParser(ansiControlSequences.concat(asciiControlSequences));
