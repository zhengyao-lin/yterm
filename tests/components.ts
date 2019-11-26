import { Source } from "../src/yterm/source";
import { Renderer, Block } from "../src/yterm/renderer";
import { UnicodeChar } from "../src/yterm/unicode"
import { Input } from "../src/yterm/input";
import { Terminal } from "../src/yterm/terminal";

import { expect } from "chai";

// just echos the input
export class EchoSource extends Source {
    constructor () {
        super();
    }

    write (data: string) {
        this.addData(data);
    }
}

export class TestSource extends Source {
    private buffer: string;

    constructor () {
        super();
        this.buffer = "";
    }

    // used by terminal
    write (data: string) {
        this.buffer += data;
    }

    // used by client
    send (data: string) {
        this.addData(data);
    }

    recv (): string | null {
        if (this.buffer !== "") {
            const ret = this.buffer;
            this.buffer = "";
            return ret;
        }

        return null;
    }

    expectRecv (data: string) {
        expect(this.recv()).equals(data);
    }
}

export class TestRenderer extends Renderer {
    private cursorColumn: number;
    private cursorRow: number;

    private screen: Array<Array<Block | null>>;

    constructor (columns: number, rows: number) {
        super(columns, rows);

        this.cursorColumn = 0;
        this.cursorRow = 0;

        this.screen = TestRenderer.newScreen(columns, rows);
    }

    static newScreen (columns: number, rows: number): Array<Array<Block | null>> {
        const screen = new Array<Array<Block | null>>(rows);

        for (let i = 0; i < rows; i++) {
            screen[i] = new Array<Block | null>(columns);

            for (let j = 0; j < rows; j++) {
                screen[i][j] = null;
            }
        }

        return screen;
    }

    setGridSize (columns: number, rows: number) {
        super.setGridSize(columns, rows);
        this.screen = TestRenderer.newScreen(columns, rows);
    }

    setBlock (block: Block | null, column: number, row: number) {
        this.assertIndexInRange(column, row);
        this.screen[row][column] = block;
    }

    getBlock (column: number, row: number): Block | null {
        this.assertIndexInRange(column, row);
        return this.screen[row][column];
    }

    setCursor (column: number, row: number) {
        if (column < 0) {
            column = 0;
        }

        if (column >= this.columns) {
            column = this.columns - 1;
        }

        if (row < 0) {
            row = 0;
        }

        if (row >= this.rows) {
            row = this.rows - 1;
        }
        
        this.cursorColumn = column;
        this.cursorRow = row;
    }

    getCursor (): { column: number, row: number } {
        return {
            column: this.cursorColumn,
            row: this.cursorRow
        }
    }

    printScreen () {
        for (let i = 0; i < this.rows; i++) {
            let line = "";

            for (let j = 0; j < this.columns; j++) {
                const block = this.getBlock(j, i);

                if (block === null || block.getChar() === null) {
                    line += " ";
                } else {
                    line += block.getChar();
                }
            }

            console.log("| " + line);
        }
    }

    expectCursorAt (column: number, row: number) {
        expect(this.cursorColumn).equals(column);
        expect(this.cursorRow).equals(row);
    }

    expectLine (column: number, row: number, data: string | Array<UnicodeChar | null>) {
        this.assertIndexInRange(column, row);
        this.assertIndexInRange(column + data.length - 1, row);

        let i = column;

        for (const char of data) {
            const block = this.getBlock(i, row);

            if (char === null) {
                if (block !== null) {
                    expect(block!.getChar()).equals(null);
                }
            } else {
                expect(block).not.to.be.null;
                expect(block!.getChar()).equals(char);
            }
        
            i++;
        }
    }

    expectBlockStyle (column: number, row: number,
                      char: UnicodeChar | null,
                      properties: Record<string, any>) {
        this.assertIndexInRange(column, row);

        const block = this.getBlock(column, row);

        if (char === null) {
            if (block !== null) {
                expect(block!.getChar()).equals(null);
            }

            return;
        }

        expect(block).not.to.be.null;

        for (const key in properties) {
            expect(block![key as keyof Block]).equals(properties[key]);
        }
    }
}

export function itWithEcho (
    msg: string, columns: number, rows: number,
    f: (s: Source, r: TestRenderer, i: Input, t: Terminal) => void
) {
    it(msg, () => {
        const source = new EchoSource();
        const renderer = new TestRenderer(columns, rows);
        const input = new Input();
        const term = new Terminal(source, renderer, input);
        f(source, renderer, input, term);
    });
}

export function itWithTerminal (
    msg: string, columns: number, rows: number,
    f: (s: TestSource, r: TestRenderer, i: Input, t: Terminal) => void
) {
    it(msg, () => {
        const source = new TestSource();
        const renderer = new TestRenderer(columns, rows);
        const input = new Input();
        const term = new Terminal(source, renderer, input);
        f(source, renderer, input, term);
    });
}
