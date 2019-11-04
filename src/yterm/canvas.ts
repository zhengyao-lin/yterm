import { Pair, assert } from "./utils";
import { Renderer, Color, Block } from "./renderer";

export class Font {
    private family: string;
    private size: number;

    constructor (family: string, size: number) {
        this.family = family;
        this.size = size;
    }

    getFamily () { return this.family; }
    getSize () { return this.size; }

    getContextFont (): string {
        return `${this.getSize()}px ${this.getFamily()}`;
    }
}

export class CanvasRenderer extends Renderer {
    static BLOCK_SPILL = 0.1;
    static DEFAULT_CURSOR_INTERVAL = 700;

    static DEFAULT_COLUMNS = 80;
    static DEFAULT_ROWS = 24;

    static DEFAULT_FONT = new Font("Ubuntu Mono", 16);

    private textLayer: HTMLCanvasElement;
    private textContext: CanvasRenderingContext2D;

    private font!: Font;
    private columns!: number;
    private rows!: number; // in number of grids
    private width!: number;
    private height!: number;
    private fontWidth!: number;
    private fontHeight!: number;
    private fontDescent!: number; // distance from the baseline

    private screen!: Array<Array<Block | null>>;

    private cursorColumn: number;
    private cursorRow: number;
    private cursorIntervalId: NodeJS.Timeout | null;
    private cursorInterval: number;

    constructor (
        parent: HTMLElement,
        columns = CanvasRenderer.DEFAULT_COLUMNS,
        rows = CanvasRenderer.DEFAULT_ROWS,
        font = CanvasRenderer.DEFAULT_FONT
    ) {
        super();

        this.textLayer = document.createElement("canvas");
        this.textContext = this.textLayer.getContext("2d")!;

        parent.appendChild(this.textLayer);

        this.cursorColumn = 0;
        this.cursorRow = 0;
        this.cursorIntervalId = null;
        this.cursorInterval = CanvasRenderer.DEFAULT_CURSOR_INTERVAL;

        this.setLayout(font, columns, rows);
        this.showCursor();
    }

    setGridSize (columns: number, rows: number) {
        this.setLayout(this.font, columns, rows);
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
        this.renderChar(column, row);
    }

    getBlock (column: number, row: number) {
        this.assertIndexInRange(column, row);
        return this.screen[row][column];
    }

    setCursor (column: number, row: number) {
        // restore the original cursor block
        this.renderChar(this.cursorColumn, this.cursorRow);
         
        this.cursorColumn = column;
        this.cursorRow = row;

        // if the cursor moves, keep it on
        this.blinkCursor(true);
    }

    getCursor (): { column: number, row: number } {
        return {
            column: this.cursorColumn,
            row: this.cursorRow
        }
    }

    private setLayout (font: Font, columns: number, rows: number) {
        assert(columns > 0 && rows > 0, "grid too small");

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

        const newScreen = new Array<Array<Block>>(this.rows);

        for (let i = 0; i < this.columns; i++) {
            newScreen[i] = new Array<Block>(this.columns);
        }

        this.screen = newScreen;

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
                if (oldScreen !== undefined &&
                    oldScreen[i] !== undefined &&
                    oldScreen[i][j] !== undefined) {
                    this.screen[i][j] = oldScreen[i][j];
                }
            }
        }

        if (!this.isInRange(this.cursorColumn, this.cursorRow)) {
            this.cursorColumn = 0;
            this.cursorRow = 0;
            this.hideCursor();
        }

        this.renderAll();
    }

    // set font and measure the dimension of the current font
    private setFont (font: Font) {
        this.textContext.save();
        this.textContext.font = font.getContextFont();
        const metrics = this.textContext.measureText("█");
        this.textContext.restore();

        this.font = font;
        this.fontWidth = metrics.width;
        this.fontHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
        this.fontDescent = metrics.actualBoundingBoxDescent;
    }

    private blinkCursor (on: boolean) {
        const block =
            this.screen[this.cursorRow][this.cursorColumn] ||
            this.getDefaultBlock();

        const inverseBlock = new Block(block.getForeground(), block.getBackground(), block.getChar());

        if (on) {
            this.renderBlock(inverseBlock, this.cursorColumn, this.cursorRow);
        } else {
            this.renderBlock(block, this.cursorColumn, this.cursorRow);
        }
    }

    private showCursor () {
        if (this.cursorIntervalId === null) {
            let on = true;

            this.cursorIntervalId = setInterval(() => {
                this.blinkCursor(on);
                on = !on;
            }, this.cursorInterval);
        }
    }

    private hideCursor () {
        if (this.cursorIntervalId !== null) {
            clearInterval(this.cursorIntervalId);
            this.cursorIntervalId = null;
        }
    }

    // render functions

    private renderBlock (block: Block, column: number, row: number) {
        this.assertIndexInRange(column, row);
        
        const x = this.fontWidth * column;
        const y = this.fontHeight * row;
        const spill = CanvasRenderer.BLOCK_SPILL;

        this.textContext.save();

        this.textContext.fillStyle = (block || this.getDefaultBlock()).getBackground();
        this.textContext.fillRect(x - spill, y - spill, this.fontWidth + 2 * spill, this.fontHeight + 2 * spill); // add 0.5 to fill the gap

        this.textContext.fillStyle = block.getForeground();
        this.textContext.font = this.font.getContextFont();
        this.textContext.fillText(block.getChar() || "", x, y + this.fontHeight - this.fontDescent);

        this.textContext.restore();
    }

    private renderChar (column: number, row: number) {
        this.assertIndexInRange(column, row);
        this.renderBlock(
            this.screen[row][column] || this.getDefaultBlock(),
            column, row
        );
    }

    // renderRange content in range
    private renderRange (column: number, row: number, nColumns: number, nRows: number) {
        this.assertIndexInRange(column, row);
        this.assertIndexInRange(column + nColumns - 1, row + nRows - 1);

        for (let i = 0; i < nColumns; i++) {
            for (let j = 0; j < nRows; j++) {
                this.renderChar(i + column, j + row);
            }
        }
    }

    private renderAll () {
        this.renderRange(0, 0, this.columns, this.rows);
    }
}
