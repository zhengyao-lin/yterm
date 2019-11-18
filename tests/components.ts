import { Source } from "../src/yterm/source";
import { Renderer, Block } from "../src/yterm/renderer";
import { unicodeLength, UnicodeChar } from "../src/yterm/unicode"

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
}

export class TestRenderer extends Renderer {
    private columns: number;
    private rows: number;
    private cursorColumn: number;
    private cursorRow: number;

    private screen: Array<Array<Block | null>>;

    constructor (columns: number, rows: number) {
        super();

        this.columns = columns;
        this.rows = rows;
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
        this.columns = columns;
        this.rows = rows;
        this.screen = TestRenderer.newScreen(columns, rows);
    }

    getGridSize (): { columns: number, rows: number } {
        return {
            columns: this.columns,
            rows: this.rows
        }
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
}
