import { SGRColor } from "./renderer";

export interface ColorScheme {
    getSGRForeground (color: SGRColor): string;
    getSGRBackground (color: SGRColor): string;
}

export class TangoColorScheme implements ColorScheme {
    static FOREGROUND_PALETTE: Record<number, string> = {
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

    static BACKGROUND_PALETTE: Record<number, string> = {
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

    getSGRForeground (color: SGRColor) {
        return TangoColorScheme.FOREGROUND_PALETTE[color];
    }
    getSGRBackground (color: SGRColor) {
        return TangoColorScheme.BACKGROUND_PALETTE[color];
    }
}
