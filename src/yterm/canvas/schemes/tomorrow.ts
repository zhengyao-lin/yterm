import { SGRColor } from "../../core/renderer";
import { ColorPaletteScheme } from "../schemes";

/**
 * A color scheme from
 * http://mayccoll.github.io/Gogh/
 */
export class TomorrowColorScheme extends ColorPaletteScheme {
    foregroundPalette: Record<SGRColor, string> = {
        [SGRColor.SGR_COLOR_BLACK]: "#000000",
        [SGRColor.SGR_COLOR_RED]: "#c82828",
        [SGRColor.SGR_COLOR_GREEN]: "#718c00",
        [SGRColor.SGR_COLOR_YELLOW]: "#eab700",
        [SGRColor.SGR_COLOR_BLUE]: "#4171ae",
        [SGRColor.SGR_COLOR_MAGENTA]: "#8959a8",
        [SGRColor.SGR_COLOR_CYAN]: "#3e999f",
        [SGRColor.SGR_COLOR_WHITE]: "#fffefe",
        [SGRColor.SGR_COLOR_DEFAULT]: "#000000"
    };

    backgroundPalette: Record<SGRColor, string> = {
        [SGRColor.SGR_COLOR_BLACK]: "#000000",
        [SGRColor.SGR_COLOR_RED]: "#c82828",
        [SGRColor.SGR_COLOR_GREEN]: "#708b00",
        [SGRColor.SGR_COLOR_YELLOW]: "#e9b600",
        [SGRColor.SGR_COLOR_BLUE]: "#4170ae",
        [SGRColor.SGR_COLOR_MAGENTA]: "#8958a7",
        [SGRColor.SGR_COLOR_CYAN]: "#3d999f",
        [SGRColor.SGR_COLOR_WHITE]: "#fffefe",
        [SGRColor.SGR_COLOR_DEFAULT]: "#fffefe"
    };
}
