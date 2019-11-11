import { assert } from "./utils";
import { Renderer, Block, Color, Intensity, TextStyle } from "./renderer";
import { ColorScheme, TangoColorScheme } from "./schemes";

export class Font {
    private family: string;
    private size: number;

    constructor (family: string, size: number) {
        this.family = family;
        this.size = size;
    }

    getFamily () { return this.family; }
    getSize () { return this.size; }

    getContextFont (style = "normal", weight = "normal"): string {
        return `${style} ${weight} ${this.getSize()}px ${this.getFamily()}`;
    }
}

export class CanvasRenderer extends Renderer {
    static BLOCK_SPILL = 0;
    static DEFAULT_CURSOR_INTERVAL = 700;

    static DEFAULT_COLUMNS = 80;
    static DEFAULT_ROWS = 24;

    static DEFAULT_SCHEME = new TangoColorScheme();

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
    private mainScreen: Array<Array<Block | null>> | null;
    private mainScreenCursorColumn: number;
    private mainScreenCursorRow: number;

    private cursorColumn: number;
    private cursorRow: number;
    private cursorIntervalId: NodeJS.Timeout | null;
    private cursorInterval: number;
    private cursorBlink: boolean;

    private colorScheme: ColorScheme;

    constructor (
        parent: HTMLElement,
        columns = CanvasRenderer.DEFAULT_COLUMNS,
        rows = CanvasRenderer.DEFAULT_ROWS,
        font = CanvasRenderer.DEFAULT_FONT,
        colorScheme = CanvasRenderer.DEFAULT_SCHEME
    ) {
        super();

        this.textLayer = document.createElement("canvas");
        this.textContext = this.textLayer.getContext("2d")!;

        parent.appendChild(this.textLayer);

        this.cursorColumn = 0;
        this.cursorRow = 0;
        this.cursorIntervalId = null;
        this.cursorInterval = CanvasRenderer.DEFAULT_CURSOR_INTERVAL;
        this.cursorBlink = true;

        this.colorScheme = colorScheme;

        this.mainScreen = null;
        this.mainScreenCursorColumn = 0;
        this.mainScreenCursorRow = 0;

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

        // if the cursor moves and the cursor is not disabled, keep it on
        if (this.cursorIntervalId !== null) {
            this.blinkCursor(true);
        }
    }

    getCursor (): { column: number, row: number } {
        return {
            column: this.cursorColumn,
            row: this.cursorRow
        }
    }

    showCursor () {
        if (this.cursorIntervalId === null) {
            let on = true;

            this.cursorIntervalId = setInterval(() => {
                this.blinkCursor(on || !this.cursorBlink);
                on = !on;
            }, this.cursorInterval);

            this.blinkCursor(true);
        }
    }

    hideCursor () {
        if (this.cursorIntervalId !== null) {
            clearInterval(this.cursorIntervalId);
            this.cursorIntervalId = null;
        }

        this.blinkCursor(false);
    }

    enableCursorBlink () {
        this.cursorBlink = true;
    }

    disableCursorBlink () {
        this.cursorBlink = false;

        if (this.cursorIntervalId !== null) {
            this.blinkCursor(true);
        }
    }

    useAlternativeScreen () {
        if (this.mainScreen === null) {
             // save the current screen
            this.mainScreen = this.screen;
        } // else already in the alternative screen

        // create a new screen of the same size
        this.screen = new Array<Array<Block>>(this.rows);

        for (let i = 0; i < this.rows; i++) {
            this.screen[i] = new Array<Block>(this.columns);
        }

        const pos = this.getCursor();
        this.mainScreenCursorColumn = pos.column;
        this.mainScreenCursorRow = pos.row;
        
        this.setCursor(0, 0);

        this.renderAll();
    }

    useMainScreen () {
        if (this.mainScreen) {
            this.screen = this.mainScreen;
            
            // reset screen since there might be grid changes
            // when we are in the alternative screen
            this.setLayout(this.font, this.screen[0].length, this.screen.length);

            this.mainScreen = null;

            this.setCursor(this.mainScreenCursorColumn, this.mainScreenCursorRow);

            this.renderAll();
        } // else already in the main screen
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

        for (let i = 0; i < this.rows; i++) {
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

        const inverseBlock = block.copy();
        inverseBlock.inversed = true;

        if (on) {
            this.renderBlock(inverseBlock, this.cursorColumn, this.cursorRow);
        } else {
            this.renderBlock(block, this.cursorColumn, this.cursorRow);
        }
    }

    // render functions

    private renderBlock (block: Block, column: number, row: number) {
        this.assertIndexInRange(column, row);
        
        const x = this.fontWidth * column;
        const y = this.fontHeight * row;
        const spill = CanvasRenderer.BLOCK_SPILL;

        this.textContext.save();

        block = block || this.getDefaultBlock();

        let background, foreground, style = "normal", weight = "normal";

        // render background
        if (typeof block.background == "string") {
            background = block.background;
        } else {
            background = this.colorScheme.getSGRBackground(block.background);
        }

        // render foreground
        if (typeof block.foreground == "string") {
            foreground = block.foreground;
        } else {
            foreground = this.colorScheme.getSGRForeground(block.foreground);
        }

        // switch background and foregound if inversed
        if (block.inversed) {
            [background, foreground] = [foreground, background];
        }

        // render text style
        switch (block.style) {
            case TextStyle.STYLE_NORMAL:
                style = "normal";
                break;

            case TextStyle.STYLE_ITALIC:
                style = "italic";
                break;
        }

        // render text weight
        switch (block.intensity) {
            case Intensity.SGR_INTENSITY_HIGH:
                weight = "bold";
                break;
            
            case Intensity.SGR_INTENSITY_LOW:
                weight = "lighter";
                break;

            case Intensity.SGR_INTENSITY_NORMAL:
                weight = "normal";
                break;
        }

        this.textContext.fillStyle = background;
        this.textContext.fillRect(x - spill, y - spill, this.fontWidth + 2 * spill, this.fontHeight + 2 * spill); // add 0.5 to fill the gap

        this.textContext.fillStyle = foreground;
        this.textContext.font = this.font.getContextFont(style, weight);
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
