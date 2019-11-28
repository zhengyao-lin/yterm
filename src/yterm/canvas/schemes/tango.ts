import { SGRColor } from "../../core/renderer";
import { ColorPaletteScheme } from "../schemes";

/**
 * A color scheme based on the Tango project
 * http://tango.freedesktop.org/Tango_Icon_Theme_Guidelines
 */
export class TangoColorScheme extends ColorPaletteScheme {
    foregroundPalette: Record<SGRColor, string> = {
        [SGRColor.SGR_COLOR_BLACK]: "#2e3436",
        [SGRColor.SGR_COLOR_RED]: "#a40000",
        [SGRColor.SGR_COLOR_GREEN]: "#8ae234",
        [SGRColor.SGR_COLOR_YELLOW]: "#c4a000",
        [SGRColor.SGR_COLOR_BLUE]: "#729fcf",
        [SGRColor.SGR_COLOR_MAGENTA]: "#5c3565",
        [SGRColor.SGR_COLOR_CYAN]: "#3465a4",
        [SGRColor.SGR_COLOR_WHITE]: "#eeeeec",
        [SGRColor.SGR_COLOR_DEFAULT]: "#eeeeec"
    };

    backgroundPalette: Record<SGRColor, string> = {
        [SGRColor.SGR_COLOR_BLACK]: "#2e3436",
        [SGRColor.SGR_COLOR_RED]: "#a40000",
        [SGRColor.SGR_COLOR_GREEN]: "#8ae234",
        [SGRColor.SGR_COLOR_YELLOW]: "#c4a000",
        [SGRColor.SGR_COLOR_BLUE]: "#729fcf",
        [SGRColor.SGR_COLOR_MAGENTA]: "#5c3565",
        [SGRColor.SGR_COLOR_CYAN]: "#3465a4",
        [SGRColor.SGR_COLOR_WHITE]: "#eeeeec",
        [SGRColor.SGR_COLOR_DEFAULT]: "#2e3436"
    };
}
