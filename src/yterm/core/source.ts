/**
 * Abstract class for a source (client program)
 */
export abstract class Source {
    private handlers: Array<(s: string) => void>;

    constructor () {
        this.handlers = [];
    }

    /** bind an event for receiving data from the client program */
    onData (handler: (s: string) => void) {
        this.handlers.push(handler);
    }

    /** writing data back to the client program */
    abstract write (data: string): void;

    protected addData (data: string) {
        for (const handler of this.handlers) {
            handler(data);
        }
    }
}
