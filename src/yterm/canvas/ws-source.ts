import { Source } from "../core/source";

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
