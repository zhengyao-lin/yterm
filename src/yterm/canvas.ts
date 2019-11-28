import { assert } from "./utils";
import { Renderer, Block, Intensity, TextStyle } from "./renderer";
import { ColorScheme, TangoColorScheme } from "./schemes";
import { TextMetrics } from "./metrics";

/**
 * Abstraction for font
 */
export class Font {
    private family: string;
    private size: number;

    constructor (family: string, size: number) {
        this.family = family;
        this.size = size;
    }

    getFamily () { return this.family; }
    getSize () { return this.size; }

    /**
     * Format a font string usable in convas context
     * @param {string} style can be italic or normal
     * @param {string} weight can be bold, lighter, or normal
     */
    getContextFont (style = "normal", weight = "normal"): string {
        return `${style} ${weight} ${this.getSize()}px ${this.getFamily()}`;
    }

    measure (): TextMetrics {
        return new TextMetrics(this.family, this.size);
    }
}

/**
 * A subclass of Renderer that renders the content
 * on a HTML5 canvas
 */
export class CanvasRenderer extends Renderer {
    /** Default settings and constants */
    static BLOCK_SPILL = 0;
    static DEFAULT_CURSOR_INTERVAL = 700;
    static DEFAULT_SCHEME = new TangoColorScheme();
    static DEFAULT_FONT = new Font("Ubuntu Mono", 16);
    static DEFAULT_FILL_COLOR = "rgba(255, 255, 255, 0.3)";

    private font!: Font;
    private width!: number;
    private height!: number;
    private fontWidth!: number;
    private fontHeight!: number;
    private fontDescent!: number;

    // DOM related fields
    private container: HTMLDivElement;

    private textLayer: HTMLCanvasElement;
    private textLayerContext: CanvasRenderingContext2D;

    private selectionLayer: HTMLCanvasElement;
    private selectionLayerContext: CanvasRenderingContext2D;

    // selection
    private selectionStart: boolean;
    private startX: number;
    private startY: number;
    private endX: number;
    private endY: number;

    // marking the dirty area that needs to be redrawn
    private dirtyMark: Record<string, boolean>;
    private dirtyAll: boolean; // a flag that overrides the dirtyMark

    private cursorIntervalId: NodeJS.Timeout | null;
    private cursorInterval: number;
    private cursorOn: boolean;

    private colorScheme: ColorScheme;

    private renderFrameId: number | null;

    constructor (
        parent: HTMLElement,
        columns = Renderer.DEFAULT_COLUMNS,
        rows = Renderer.DEFAULT_ROWS,
        font = CanvasRenderer.DEFAULT_FONT,
        colorScheme = CanvasRenderer.DEFAULT_SCHEME
    ) {
        super(columns, rows);

        // initialize fields
        this.cursorIntervalId = null;
        this.cursorInterval = CanvasRenderer.DEFAULT_CURSOR_INTERVAL;
        this.cursorOn = false;

        this.colorScheme = colorScheme;

        this.dirtyMark = {};
        this.dirtyAll = false;

        this.renderFrameId = null;

        // initialize DOM elements
        this.container = document.createElement("div");
        this.container.style.position = "relative";
        parent.appendChild(this.container);

        this.textLayer = document.createElement("canvas");
        this.textLayerContext = this.textLayer.getContext("2d")!;
        this.container.appendChild(this.textLayer);

        this.selectionLayer = document.createElement("canvas");
        this.selectionLayer.style.position = "absolute";
        this.selectionLayer.style.left = "0";
        this.selectionLayer.style.top = "0";
        this.container.appendChild(this.selectionLayer);

        this.selectionLayerContext = this.selectionLayer.getContext("2d")!;

        this.selectionStart = false;

        this.startX = 0;
        this.startY = 0;
        this.endX = 0;
        this.endY = 0;

        this.selectionLayer.addEventListener("mousedown", this.mouseDownEvent.bind(this), false);
        this.selectionLayer.addEventListener("mouseup", this.mouseUpEvent.bind(this), false);
        this.selectionLayer.addEventListener("mousemove", this.mouseMoveEvent.bind(this), false);

        document.addEventListener("keydown", this.keydownEvent.bind(this));

        this.updateLayout(font, columns, rows);
        this.enableCursorBlink();

        this.startRender();
    }

    /**
     * Set the grid size of the terminal
     */
    setSize (columns: number, rows: number) {
        super.setSize(columns, rows);
        this.updateLayout(this.font, columns, rows);
    }

    /**
     * Set a particular block
     * @param block can be null
     */
    setBlock (block: Block | null, column: number, row: number) {
        super.setBlock(block, column, row);
        this.markRenderChar(column, row);
    }

    /**
     * Set the position of the cursor
     */
    setCursor (column: number, row: number) {
        const { column: oldCursorColumn, row: oldCursorRow } = this.getCursor();
        
        super.setCursor(column, row);

        const { column: cursorColumn, row: cursorRow } = this.getCursor();

        // restore the original cursor block
        this.markRenderChar(oldCursorColumn, oldCursorRow);
        this.markRenderChar(cursorColumn, cursorRow);

        // if the cursor moves and the cursor is not disabled, keep it on
        if (this.cursorIntervalId !== null) {
            this.cursorOn = true;
        }
    }

    scroll (n: number, ...args: any) {
        super.scroll(n, ...args);
        this.markRenderAll();
    }

    showCursor () {
        this.enableCursorBlink();
        this.cursorOn = true;
    }

    hideCursor () {
        this.disableCursorBlink();
        this.cursorOn = false;
    }

    enableCursorBlink () {
        if (this.cursorIntervalId === null) {
            this.cursorIntervalId = setInterval(() => {
                this.cursorOn = !this.cursorOn;
            }, this.cursorInterval);
        }
    }

    disableCursorBlink () {
        if (this.cursorIntervalId !== null) {
            clearInterval(this.cursorIntervalId);
            this.cursorIntervalId = null;
        }
    }

    /**
     * Switch to an alternative screen buffer.
     * This function will clear the alternative screen before switching.
     */
    useAlternativeScreen () {
        super.useAlternativeScreen();
        this.markRenderAll();
    }

    /**
     * Switch back to the original main screen.
     * Only usable when the current screen is an alternative one.
     */
    useMainScreen () {
        super.useMainScreen();
        this.markRenderAll();
    }

    private offsetToGirdPosition (offsetX: number, offsetY: number): { column: number, row: number } {
        const column = Math.floor(offsetX / this.fontWidth);
        const row = Math.floor(offsetY / this.fontHeight);

        return {
            column, row
        };
    }

    /**
     * Returns position in pixels of the left top corner of a given grid position
     */
    private gridPositionToOffset (column: number, row: number): { offsetX: number, offsetY: number } {
        return {
            offsetX: column * this.fontWidth,
            offsetY: row * this.fontHeight
        };
    }

    private gridPositionToIndex (column: number, row: number): number {
        const { columns } = this.getSize();
        return row * columns + column;
    }

    private indexToGridPosition (index: number): { column: number, row: number } {
        const { columns } = this.getSize();
        return {
            column: Math.floor(index) % columns,
            row: Math.floor(index / columns)
        };
    }

    /**
     * Get the range of selection
     * returns null if nothing is selected
     */
    private getSelection (): null | { startColumn: number, startRow: number, endColumn: number, endRow: number } {
        let { column: startColumn, row: startRow } = this.offsetToGirdPosition(this.startX, this.startY);
        let { column: endColumn, row: endRow } = this.offsetToGirdPosition(this.endX, this.endY);
        let startIndex = this.gridPositionToIndex(startColumn, startRow);
        let endIndex = this.gridPositionToIndex(endColumn, endRow);

        const halfWidth = this.fontWidth / 2;

        const { offsetX: startLeftX, offsetY: startTopY } = this.gridPositionToOffset(startColumn, startRow);
        const { offsetX: endLeftX, offsetY: endTopY } = this.gridPositionToOffset(endColumn, endRow);

        if (startIndex <= endIndex) {
            // selecting from low index to high index

            // start column is selected iff the cursor is in the left half of the block
            // end column is selected iff the cursor is in the right half of the block
            //
            //  start                 end
            // --------             --------
            // |  /\  |     ->      |  /\  |
            // | x__\ | ........... | /__x |
            // |/    \|             |/    \|
            // --------             --------

            // shift start position one unit to the right
            // if the start offset is in the right half of the block
            if (this.startX > startLeftX + halfWidth) {
                const adjusted = this.indexToGridPosition(startIndex + 1);
                startColumn = adjusted.column;
                startRow = adjusted.row;
            }

            // similarly, shift the end position one unit to the left
            // if the end offset is in the left half of the block
            if (this.endX < endLeftX + halfWidth) {
                const adjusted = this.indexToGridPosition(endIndex - 1);
                endColumn = adjusted.column;
                endRow = adjusted.row;
            }

            // update start/end indices
            startIndex = this.gridPositionToIndex(startColumn, startRow);
            endIndex = this.gridPositionToIndex(endColumn, endRow);

            // if we actually switched direction, then nothing is selected
            if (startIndex > endIndex) {
                return null;
            } else {
                // something is selected
                return {
                    startColumn,
                    startRow,
                    endColumn,
                    endRow
                };
            }
        } else {
            // selecting from high index to low index
            // start column is selected iff the cursor is in the right half of the block
            // end column is selected iff the cursor is in the left half of the block
            //
            //   end                 start
            // --------             --------
            // |  /\  |     <-      |  /\  |
            // | x__\ | ........... | /__x |
            // |/    \|             |/    \|
            // --------             --------

            // shift start position one unit to the left
            // if the start offset is in the left half of the block
            if (this.startX < startLeftX + halfWidth) {
                const adjusted = this.indexToGridPosition(startIndex - 1);
                startColumn = adjusted.column;
                startRow = adjusted.row;
            }

            // similarly, shift the end position one unit to the right
            // if the end offset is in the right half of the block
            if (this.endX > endLeftX + halfWidth) {
                const adjusted = this.indexToGridPosition(endIndex + 1);
                endColumn = adjusted.column;
                endRow = adjusted.row;
            }

            // if we actually switched direction, then nothing is selected
            if (startIndex <= endIndex) {
                return null;
            } else {
                // something is selected
                return {
                    startColumn: endColumn,
                    startRow: endRow,
                    endColumn: startColumn,
                    endRow: startRow
                };
            }
        }
    }

    /**
     * Extract text from row `row` and [from, to]
     */
    private lineToText (row: number, from: number, to: number): string {
        if (from > to) return "";

        let result = "";

        for (let column = from; column <= to; column++) {
            const block = this.getBlock(column, row);

            if (block) {
                const char = block.getChar();

                if (char !== null) {
                    result += char;
                }
            }
        }

        return result;
    }

    /**
     * Extract text from the current selection
     */
    private getSelectedText (): string {
        const selection = this.getSelection();
        if (selection === null) return "";

        const lines = new Array<string>();

        const { columns } = this.getSize();

        const {
            startColumn,
            startRow,
            endColumn,
            endRow
        } = selection;

        for (let row = startRow; row <= endRow; row++) {
            if (row == startRow && row == endRow) {
                lines.push(this.lineToText(row, startColumn, endColumn));
            } else if (row == startRow) {
                lines.push(this.lineToText(row, startColumn, columns - 1));
            } else if (row == endRow) {
                lines.push(this.lineToText(row, 0, endColumn));
            } else {
                lines.push(this.lineToText(row, 0, columns - 1));
            }
        }

        return lines.join("\n");
    }

    private keydownEvent (event: KeyboardEvent) {
        const preventDefault = () => {
            event.preventDefault();
            event.stopImmediatePropagation();
        };

        if (event.ctrlKey && event.shiftKey && !event.altKey) {
            switch (event.key.toLowerCase()) {
                case "c": {
                    const text = this.getSelectedText();
                    navigator.clipboard
                        .writeText(text)
                        .catch(err => console.warn(err));

                    preventDefault();
                    break;
                }
            }
        }
    }

    private mouseDownEvent (event: MouseEvent) {
        if (!this.selectionStart) {
            this.selectionStart = true;
            this.startX = this.endX = event.offsetX;
            this.startY = this.endY = event.offsetY;
        }
    }

    private mouseUpEvent (event: MouseEvent) {
        this.selectionStart = false;
    }

    private mouseMoveEvent (event: MouseEvent) {
        if (this.selectionStart) {
            this.endX = event.offsetX;
            this.endY = event.offsetY;
        }
    }

    /**
     * Adjust the display according to the grid size and font
     */
    private updateLayout (font: Font, columns: number, rows: number) {
        assert(columns > 0 && rows > 0, "grid too small");

        // initialize font
        this.setFont(font);

        this.width = this.fontWidth * columns;
        this.height = this.fontHeight * rows;

        this.textLayer.width = this.width;
        this.textLayer.height = this.height;

        this.selectionLayer.width = this.width;
        this.selectionLayer.height = this.height;

        this.markRenderAll();
    }

    /**
     * Set font and measure the dimension of the current font
     */
    private setFont (font: Font) {
        this.font = font;
        const metrics = this.font.measure();

        this.fontDescent = metrics.measureMaxDescent();
        this.fontWidth = metrics.measureMaxWidth() + 1;
        this.fontHeight = metrics.measureMaxHeight() + this.fontDescent;

        console.log(this.fontWidth, this.fontHeight, this.fontDescent);
    }

    /**
     * markRender* functions are used for marking dirty areas
     * but not redrawing immediately
     */
    private markRenderChar (column: number, row: number) {
        this.dirtyMark[column + "," + row] = true;
    }

    private markRenderAll () {
        this.dirtyAll = true;
    }

    /**
     * Render a single block at the given position (column, row)
     */
    private renderCursor () {
        const { column, row } = this.getCursor();
        const block = this.getBlock(column, row) || this.getDefaultBlock();

        const inverseBlock = block.copy();
        inverseBlock.reversed = true;

        if (this.cursorOn) {
            this.renderBlock(inverseBlock, column, row);
        } else {
            this.renderBlock(block, column, row);
        }
    }

    private renderBlock (block: Block, column: number, row: number) {
        this.assertInRange(column, row);
        
        const x = this.fontWidth * column;
        const y = this.fontHeight * row;
        const spill = CanvasRenderer.BLOCK_SPILL;

        this.textLayerContext.save();

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

        // switch background and foregound if reversed
        if (block.reversed) {
            [background, foreground] = [foreground, background];
        }

        // render text style
        if (block.style == TextStyle.STYLE_ITALIC) {
            style = "italic";
        }

        // render text weight
        if (block.intensity == Intensity.SGR_INTENSITY_HIGH) {
            weight = "bold";
        } else if (block.intensity == Intensity.SGR_INTENSITY_LOW) {
            weight = "lighter";
        }

        this.textLayerContext.fillStyle = background;
        this.textLayerContext.fillRect(x - spill, y - spill, this.fontWidth + 2 * spill, this.fontHeight + 2 * spill);

        this.textLayerContext.fillStyle = foreground;
        this.textLayerContext.font = this.font.getContextFont(style, weight);
        this.textLayerContext.fillText(block.getChar() || "", x, y + this.fontHeight - this.fontDescent);

        this.textLayerContext.restore();
    }

    /**
     * A wrapper of renderBlock that reads the current block at a given position
     * and renders it
     * @param {number} column
     * @param {number} row
     */
    private renderChar (column: number, row: number) {
        this.assertInRange(column, row);

        this.renderBlock(
            this.getBlock(column, row) || this.getDefaultBlock(),
            column, row
        );
    }

    private renderSelection () {
        const selection = this.getSelection();
        const { columns } = this.getSize();

        this.selectionLayerContext.clearRect(0, 0, this.selectionLayer.width, this.selectionLayer.height);

        if (selection !== null) {
            const { startColumn, startRow, endColumn, endRow } = selection;

            assert(startRow <= endRow, `invalid start and end row ${startRow}, ${endRow}`);

            this.selectionLayerContext.save();
            this.selectionLayerContext.fillStyle = CanvasRenderer.DEFAULT_FILL_COLOR;

            for (let row = startRow; row <= endRow; row++) {
                if (row == startRow && row == endRow) {
                    // draw a rectangle from start column to the end column
                    const { offsetX, offsetY } = this.gridPositionToOffset(startColumn, row);
                    this.selectionLayerContext.fillRect(offsetX, offsetY, (endColumn + 1 - startColumn) * this.fontWidth, this.fontHeight);
                } else if (row == startRow) {
                    // draw a rectangle from the start column to the end
                    const { offsetX, offsetY } = this.gridPositionToOffset(startColumn, row);
                    this.selectionLayerContext.fillRect(offsetX, offsetY, (columns - startColumn) * this.fontWidth, this.fontHeight);
                } else if (row == endRow) {
                    // draw a rectangle from the start to the end column
                    const { offsetX, offsetY } = this.gridPositionToOffset(endColumn + 1, row);
                    this.selectionLayerContext.fillRect(offsetX, offsetY, (0 - endColumn - 1) * this.fontWidth, this.fontHeight);
                } else {
                    // draw a rectangle across the entire line
                    const { offsetX, offsetY } = this.gridPositionToOffset(0, row);
                    this.selectionLayerContext.fillRect(offsetX, offsetY, columns * this.fontWidth, this.fontHeight);
                }
            }

            this.selectionLayerContext.restore();
        }
    }

    private renderText () {
        const { columns, rows } = this.getSize();

        if (this.dirtyAll) {
            for (let i = 0; i < columns; i++) {
                for (let j = 0; j < rows; j++) {
                    this.renderChar(i, j);
                }
            }
        } else {
            for (let i = 0; i < columns; i++) {
                for (let j = 0; j < rows; j++) {
                    if (this.dirtyMark[i + "," + j] === true) {
                        this.renderChar(i, j);
                    }
                }
            }
        }

        // clear all dirty marks
        this.dirtyMark = {};
        this.dirtyAll = false;
    }

    /**
     * Rerender everything
     * Avoid calling this function directly
     */
    private renderAll () {
        this.renderText();
        this.renderSelection();
        this.renderCursor();
    }

    /**
     * Main render loop
     */
    private startRender () {
        if (this.renderFrameId === null) {
            const renderer = () => {
                this.renderAll();
                this.renderFrameId = window.requestAnimationFrame(renderer);
            };

            renderer();
        }
    }
}
