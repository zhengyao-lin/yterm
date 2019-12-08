import ws from "ws";
import { spawn } from "node-pty";

const server = new ws.Server({ host: "localhost", port: 3131 });
const proc = spawn("bash", [], {
    cols: 82,
    rows: 25
});

const connections: Record<number, ws> = {};
let connectionId = 0;

proc.on("data", (data: string) => {
    for (const connId in connections) {
        try {
            connections[connId].send(data);
        } catch (e) {
            console.warn(`failed to send data to connection ${connId}`, e);
        }
    }
});

server.on("connection", ws => {
    const id = connectionId++;

    connections[id] = ws;

    ws.on("message", (msg: Buffer) => {
        proc.write(msg.toString());
    });

    ws.on("close", () => {
        delete connections[id];
    });
});

server.on("listening", () => {
    console.log("listening on", server.address());
    console.log("open demo.html to view the frontend");
});

process.on("exit", () => {
    console.log("killing client process");
    proc.kill();
});
