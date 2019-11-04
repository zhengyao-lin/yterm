import { Pair, assert } from "./utils";
import { Renderer, Font, Color, Block } from "./renderer";

export class CanvasRenderer implements Renderer {
    private textLayer: HTMLCanvasElement;
    private textContext: CanvasRenderingContext2D;
    private selectionLayer: HTMLCanvasElement;
    private parent: HTMLElement;

    private font: Font;
    private columns: number;
    private rows: number; // in number of grids
    private width: number;
    private height: number;
    private fontWidth: number;
    private fontHeight: number;
    private fontDescent: number; // distance from the baseline

    private background: Color; // default background

    private screen: Array<Array<Block>>;

    private cursor: Pair<number, number>;
    private cursorIntervalId: number | null;
    private cursorInterval: number;

    static blockSpill = 0.7;

    static getContextFont (font: Font): string {
        return `${font.getSize()}px ${font.getFamily()}`;
    }

    constructor (parent: HTMLElement, columns = 80, rows = 24, font = Font.defaultFont()) {
        this.textLayer = document.createElement("canvas");
        this.textContext = this.textLayer.getContext("2d");

        // this.selectionLayer = document.createElement("canvas");
        this.parent = parent;
        
        this.background = "#000";

        parent.appendChild(this.textLayer);
        // parent.appendChild(this.selectionLayer);

        this.cursor = null;
        this.cursorIntervalId = null;
        this.cursorInterval = 800;

        this.setLayout(font, columns, rows);
    }

    setGridSize (columns: number, rows: number) {
        this.setLayout(this.font, columns, rows);
    }

    setLayout (font: Font, columns: number, rows: number) {
        // initialize font
        this.setFont(font);

        this.columns = columns;
        this.width = this.fontWidth * columns;
    
        this.rows = rows;
        this.height = this.fontHeight * rows;

        this.textLayer.width = this.width;
        this.textLayer.height = this.height;

        // reinit screen
        const oldScreen = this.screen;

        this.clear();

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
                if (oldScreen !== undefined &&
                    oldScreen[i] !== undefined &&
                    oldScreen[i][j] !== undefined) {
                    this.screen[i][j] = oldScreen[i][j];
                }
            }
        }

        if (this.cursor && !this.isInRange(this.cursor.fst, this.cursor.snd)) {
            this.cursor = null;
        }

        this.renderAll();
    }

    // set font and measure the dimension of the current font
    setFont (font: Font) {
        this.textContext.save();
        this.textContext.font = CanvasRenderer.getContextFont(font);
        const metrics = this.textContext.measureText("█");
        this.textContext.restore();

        this.font = font;
        this.fontWidth = metrics.width;
        this.fontHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
        this.fontDescent = metrics.actualBoundingBoxDescent;
    }

    getGridSize (): { columns: number, rows: number } {
        return {
            columns: this.columns,
            rows: this.rows
        }
    }

    getSize (): { height: number, width: number } {
        return {
            height: this.height,
            width: this.width
        }
    }

    isInRange (column: number, row: number): boolean {
        return column >= 0 && column < this.columns && row >= 0 && row < this.rows;
    }

    assertIndexInRange (column: number, row: number) {
        assert(this.isInRange(column, row), `position (${column}, ${row}) out of bounds`);
    }

    // column and row starts from 0
    printBlock (block: Block, column: number, row: number) {
        this.assertIndexInRange(column, row);
        this.screen[row][column] = block;
        this.renderChar(column, row);
    }

    printLetter (letter: string, column: number, row: number, foreground = "#fff") {
        this.assertIndexInRange(column, row);
        this.screen[row][column] = new Block(this.background, foreground, letter);
        this.renderChar(column, row);
    }

    setCursor (column: number, row: number) {
        if (this.cursor) {
            // restore the original cursor block
            this.renderChar(this.cursor.fst, this.cursor.snd);
        }
     
        this.cursor = new Pair(column, row);
        this.renderCursor();
    }

    clear (render = true) {
        const newScreen = new Array<Array<Block>>(this.rows);

        for (let i = 0; i < this.columns; i++) {
            newScreen[i] = new Array<Block>(this.columns);
        }

        this.screen = newScreen;

        if (render) {
            this.renderAll();
        }
    }

    // scroll down the screen for n rows
    scrollDown (n: number, render = true) {
        if (n > this.rows) {
            n = this.rows;
        }

        this.screen = this.screen.slice(n);

        for (let i = 0; i < n; i++) {
            this.screen.push(new Array(this.columns));
        }

        if (this.cursor) {
            this.cursor.snd -= n;

            if (!this.isInRange(this.cursor.fst, this.cursor.snd)) {
                this.cursor = null;
            }
        }

        if (render) {
            this.renderAll();
        }
    }

    // render functions

    renderBlock (block: Block, column: number, row: number) {
        this.assertIndexInRange(column, row);
        
        const x = this.fontWidth * column;
        const y = this.fontHeight * row;
        const spill = CanvasRenderer.blockSpill;

        this.textContext.save();

        this.textContext.fillStyle = block ? block.getBackground() : this.background;
        this.textContext.fillRect(x - spill, y - spill, this.fontWidth + 2 * spill, this.fontHeight + 2 * spill); // add 0.5 to fill the gap

        this.textContext.fillStyle = block.getForeground();
        this.textContext.font = CanvasRenderer.getContextFont(this.font);
        this.textContext.fillText(block.getChar() || "", x, y + this.fontHeight - this.fontDescent);

        this.textContext.restore();
    }

    renderChar (column: number, row: number) {
        this.assertIndexInRange(column, row);
        this.renderBlock(this.screen[row][column] || new Block(this.background, "#fff"), column, row);
    }

    // renderRange content in range
    renderRange (column: number, row: number, nColumns: number, nRows: number) {
        this.assertIndexInRange(column, row);
        this.assertIndexInRange(column + nColumns - 1, row + nRows - 1);

        for (let i = 0; i < nColumns; i++) {
            for (let j = 0; j < nRows; j++) {
                this.renderChar(i + column, j + row);
            }
        }
    }

    renderCursor () {
        if (this.cursorIntervalId === null) {
            let on = true;

            this.cursorIntervalId = setInterval(() => {
                if (this.cursor) {
                    const { fst: column, snd: row } = this.cursor;
                    const block = this.screen[row][column] || new Block(this.background, "#fff");
                    const inverseBlock = new Block(block.getForeground(), block.getBackground(), block.getChar());

                    if (on) {
                        this.renderBlock(inverseBlock, column, row);
                    } else {
                        this.renderBlock(block, column, row);
                    }
                }

                on = !on;
            }, this.cursorInterval);
        }
    }

    renderAll () {
        this.renderRange(0, 0, this.columns, this.rows);
        this.renderCursor();
    }
}
