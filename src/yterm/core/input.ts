/**
 * An abstraction of input
 */
export class Input {
    private handlers: Array<(a: string) => void>;

    public applicationCursorMode: boolean;

    constructor () {
        this.handlers = [];
        this.applicationCursorMode = false;
    }

    onInput (handler: (a: string) => void) {
        this.handlers.push(handler);
    }

    input (data: string) {
        for (const handler of this.handlers) {
            handler(data);
        }
    }

    // https://the.earth.li/~sgtatham/putty/0.60/htmldoc/Chapter4.html#config-appcursor
    setApplicationCursorMode (enable: boolean) {
        this.applicationCursorMode = enable;
    }
};
