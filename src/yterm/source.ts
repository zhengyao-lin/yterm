export abstract class Source {
    private handlers: Array<(s: string) => void>;

    constructor () {
        this.handlers = [];
    }

    onData (handler: (s: string) => void) {
        this.handlers.push(handler);
    }

    // only called by subclasses
    protected addData (data: string) {
        for (const handler of this.handlers) {
            handler(data);
        }
    }

    abstract write (data: string): void;
}

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
