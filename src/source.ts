export interface Source {
    onData (handler: (string) => void);
    write (data: string);
}

export class WebSocketSource implements Source {
    private ws: WebSocket;
    private buffer: string;
    private connected: boolean;

    constructor (host) {
        this.ws = new WebSocket(host);
        this.buffer = "";
        this.connected = false;

        this.ws.onopen = () => {
            if (this.buffer.length) {
                this.ws.send(this.buffer);
            }
            
            this.connected = true;
        };
    }

    onData (handler: (string) => void) {
        this.ws.onmessage = event => {
            handler(event.data);
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
