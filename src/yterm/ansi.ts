// base class for ANSI sequence
export enum ANSICommand {
    ESC_TITLE = "ESC_TITLE",
    ESC_GRAPHIC_RENDITION = "ESC_GRAPHIC_RENDITION",
    ESC_ERASE_IN_LINE = "ESC_ERASE_IN_LINE",
    ESC_SET_DIMENSIONS = "ESC_SET_DIMENSIONS",

    ESC_CURSOR_MOVE = "ESC_CURSOR_MOVE",
    ESC_DELETE_CHAR = "ESC_DELETE_CHAR",
    ESC_INSERT_CHAR = "ESC_INSERT_CHAR",

    CTRL_BELL = "CTRL_BELL",
    CTRL_BACKSPACE = "CTRL_BACKSPACE",
    CTRL_TAB = "CTRL_TAB",
    CTRL_CARRIAGE_RETURN = "CTRL_CARRIAGE_RETURN"
};

export class ANSISequence {
    public cmd: ANSICommand;
    public args: Array<any>;

    constructor (cmd: ANSICommand, args: Array<any>) {
        this.cmd = cmd;
        this.args = args;
    }

    toString (): string {
        return `escaped ${this.cmd} (${this.args.join(", ")})`;
    }
};

const escapeSequences = [
    {
        pattern: /^\x1b]0;([^\x1b\x07]+)\x07/,
        handler: (match: RegExpExecArray) => {
            return new ANSISequence(ANSICommand.ESC_TITLE, [match[1]]);
        }
    },

    {
        pattern: /^\x1b\[(\d*)(A|B|C|D)/,
        handler: (match: RegExpExecArray) => {
            return new ANSISequence(ANSICommand.ESC_CURSOR_MOVE, [parseInt(match[1] || "1"), match[2]]);
        }
    },

    {
        pattern: /^\x1b\[((\d+)?(;(\d+)?)*)m/,
        handler: (match: RegExpExecArray) => {
            const modes = match[1].split(";");
            const args = [];

            for (const mode of modes) {
                if (mode === "") {
                    args.push(0);
                } else {
                    args.push(parseInt(mode));
                }
            }
        
            return new ANSISequence(ANSICommand.ESC_GRAPHIC_RENDITION, args);;
        }
    },

    {
        pattern: /^\x1b\[(\d?)K/,
        handler: (match: RegExpExecArray) => {
            return new ANSISequence(ANSICommand.ESC_ERASE_IN_LINE, [parseInt(match[1])]);
        }
    },

    {
        pattern: /^\x1b\[(\d*)P/,
        handler: (match: RegExpExecArray) => {
            return new ANSISequence(ANSICommand.ESC_DELETE_CHAR, [parseInt(match[1] || "1")]);
        }
    },

    {
        pattern: /^\x1b\[(\d*)@/,
        handler: (match: RegExpExecArray) => {
            return new ANSISequence(ANSICommand.ESC_INSERT_CHAR, [parseInt(match[1] || "1")]);
        }
    },

    {
        pattern: /^\x1b\[8;(\d+);(\d+)t/,
        handler: (match: RegExpExecArray) => {
            return new ANSISequence(ANSICommand.ESC_SET_DIMENSIONS, [parseInt(match[1]), parseInt(match[2])]);
        }
    },

    {
        pattern: /^\x07/,
        handler: () => {
            return new ANSISequence(ANSICommand.CTRL_BELL, []);
        }
    },

    {
        pattern: /^\x08/,
        handler: () => {
            return new ANSISequence(ANSICommand.CTRL_BACKSPACE, []);
        }
    },

    {
        pattern: /^\x09/,
        handler: () => {
            return new ANSISequence(ANSICommand.CTRL_TAB, []);
        }
    },

    {
        pattern: /^\x0d/,
        handler: () => {
            return new ANSISequence(ANSICommand.CTRL_CARRIAGE_RETURN, []);
        }
    }
];

// parse a data stream as a sequence of chunks and pass them to the handler
export function parseANSIStream (data: string, handler: (chunk: ANSISequence | string) => void) {
    // console.log([...data].map(c => c.charCodeAt(0)));

    while (data.length) {
        const pos = data.search(/\x1b|\x07|\x08|\x09|\x0d/);
        let match = null;

        if (pos == -1) {
            handler(data);
            break;
        }

        if (pos) {
            handler(data.substring(0, pos));
        }
        
        data = data.substring(pos);

        for (const { pattern, handler: lexHandler } of escapeSequences) {
            match = pattern.exec(data);
            
            if (match !== null) {
                handler(lexHandler(match));
                data = data.substring(match[0].length);
                break;
            }
        }

        if (!match) {
            handler(data.substring(0, 1));
            data = data.substring(1);
        }
    }
}
