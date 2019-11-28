import { SGRColor } from "../../core/renderer";
import { ColorScheme } from "../schemes";
import { assert } from "../../core/utils";

/**
 * A transition color scheme is meant to be used
 * for transition animation between two color schemes
 */
export class TransitionColorScheme implements ColorScheme {
    private leftScheme: ColorScheme;
    private rightScheme: ColorScheme;

    private t: number;

    constructor (leftScheme: ColorScheme, rightScheme: ColorScheme, t: number = 0) {
        this.leftScheme = leftScheme;
        this.rightScheme = rightScheme;

        this.t = 0;
        this.setTransition(t);
    }

    setTransition (t: number) {
        assert(t >= 0 && t <= 1, "transitional parameter should be in a compact interval [0, 1]");
        this.t = t;
    }

    getSGRForeground (color: SGRColor): string {
        const leftColor = this.leftScheme.getSGRForeground(color);
        const rightColor = this.rightScheme.getSGRForeground(color);
        return this.intermediateColor(leftColor, rightColor);
    }

    getSGRBackground (color: SGRColor): string {
        const leftColor = this.leftScheme.getSGRBackground(color);
        const rightColor = this.rightScheme.getSGRBackground(color);
        return this.intermediateColor(leftColor, rightColor);
    }

    private intermediateColor (leftColor: string, rightColor: string) {
        assert(leftColor.match(/^#[0-9a-fA-F]{6}$/) != null &&
               rightColor.match(/^#[0-9a-fA-F]{6}$/) != null, "only supports hex color");

        const leftR = parseInt(leftColor.substring(1, 3), 16);
        const leftG = parseInt(leftColor.substring(3, 5), 16);
        const leftB = parseInt(leftColor.substring(5, 7), 16);

        const rightR = parseInt(rightColor.substring(1, 3), 16);
        const rightG = parseInt(rightColor.substring(3, 5), 16);
        const rightB = parseInt(rightColor.substring(5, 7), 16);

        const finalR = this.t * rightR + (1 - this.t) * leftR;
        const finalG = this.t * rightG + (1 - this.t) * leftG;
        const finalB = this.t * rightB + (1 - this.t) * leftB;

        return `rgb(${finalR}, ${finalG}, ${finalB})`;
    }
}
