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

/**
 * Websocket implementation for a source
 */
export class WebSocketSource extends Source {
    private ws: WebSocket;
    private buffer: string;
    private connected: boolean;

    constructor (host: string) {
        super();

        this.ws = new WebSocket(host);
        this.buffer = "";
        this.connected = false;

        this.ws.onopen = () => {
            if (this.buffer.length) {
                this.ws.send(this.buffer);
            }
            
            this.connected = true;
        };

        this.ws.onmessage = event => {
            this.addData(event.data);
        };
    }

    write (data: string) {
        if (this.connected) {
            this.ws.send(data);
        } else {
            this.buffer += data;
        }
    }
}
