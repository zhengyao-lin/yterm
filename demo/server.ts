import ws from "ws";
import { spawn, IPty } from "node-pty";

const server = new ws.Server({ host: "localhost", port: 3131 });
const processes = new Set<IPty>();

server.on("connection", ws => {
    const proc = spawn("bash", [], {
        cols: 80,
        rows: 24
    });

    processes.add(proc);

    proc.on("data", (data: string) => {
        ws.send(data);
    });

    ws.on("message", (msg: Buffer) => {
        proc.write(msg.toString());
    });

    ws.on("close", () => {
        proc.kill();
        processes.delete(proc);
    });
});

process.on("exit", () => {
    console.log("killing all processes");

    for (const proc of processes) {
        proc.kill();
    }
});
