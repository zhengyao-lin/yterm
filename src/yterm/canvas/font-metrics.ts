/**
 * Utility class for measruing text metrics
 * measuring tricks from https://github.com/soulwire/FontMetrics
 */
export class TextMetrics {
    private fontFamily: string;
    private fontSize: number;

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor (fontFamily: string, fontSize: number) {
        this.fontFamily = fontFamily;
        this.fontSize = fontSize;

        this.canvas = document.createElement("canvas");

        // setting the dimension to 2 * fontSize in case of any oferflow
        this.canvas.width = fontSize * 1.5;
        this.canvas.height = fontSize * 1.5;

        this.ctx = this.canvas.getContext("2d")!;
    }

    /**
     * max distance from any ascender to any descender
     */
    measureMaxHeight (): number {
        return this.getDimension("h").height -
               this.getDimension("x").height +
               this.getDimension("g").height;
    }

    measureMaxWidth (): number {
        return this.getDimension("W").width;
    }

    measureMaxDescent (): number {
        return this.getDimension("g").height -
               this.getDimension("x").height;
    }

    private getCanvasFont (): string {
        return `${this.fontSize}px ${this.fontFamily}`;
    }

    private clearCanvas () {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    private pixelIndexToPosition (index: number): {x: number, y: number} {
        index = Math.floor(index / 4);
        return {
            x: index % this.canvas.width,
            y: Math.floor(index / this.canvas.width)
        };
    }

    private getDimension (text: string): { width: number, height: number } {
        this.clearCanvas();
        
        this.ctx.font = this.getCanvasFont();
        this.ctx.fillStyle = "rgba(255, 255, 255, 255)";
        this.ctx.fillText(text, this.fontSize * 0.5, this.fontSize);

        const pixels = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;

        let minX = this.canvas.width, maxX = 0;
        let minY = this.canvas.height, maxY = 0;

        for (let i = 0; i < pixels.length; i++) {
            if (pixels[i] != 0) {
                const {x, y} = this.pixelIndexToPosition(i);

                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }

        return {
            width: maxX - minX,
            height: maxY - minY
        };
    }
};
