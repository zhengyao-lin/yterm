import { SGRColor } from "../core/renderer";
import { TextMetrics } from "./font-metrics";

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

export interface ColorScheme {
    getSGRForeground (color: SGRColor): string;
    getSGRBackground (color: SGRColor): string;
}

/**
 * ColorPaletteScheme is a simple color scheme
 * that uses a lookup table to map colors
 */
export abstract class ColorPaletteScheme {
    protected abstract foregroundPalette: Record<SGRColor, string>;
    protected abstract backgroundPalette: Record<SGRColor, string>;

    getSGRForeground (color: SGRColor): string {
        return this.foregroundPalette[color];
    }

    getSGRBackground (color: SGRColor): string {
        return this.backgroundPalette[color];
    }
}

/**
 * Umbrella class of style related configs
 */
export class StyleScheme {
    public font: Font;
    public colorScheme: ColorScheme;
    public selectionColor: string;
    public cursorInterval: number; // in ms

    constructor (
        {
            font,
            colorScheme,
            selectionColor = "rgba(0, 0, 0, 0.2)",
            cursorInterval = 700,
        }: {
            font: Font,
            colorScheme: ColorScheme,
            selectionColor?: string,
            cursorInterval?: number
        }
    ) {
        this.font = font;
        this.colorScheme = colorScheme;
        this.selectionColor = selectionColor;
        this.cursorInterval = cursorInterval;
    }
};
