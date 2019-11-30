import ws from "ws";
import { spawn, IPty } from "node-pty";

const server = new ws.Server({ host: "localhost", port: 3131 });
const processes = new Set<IPty>();

server.on("connection", ws => {
    const proc = spawn("bash", [], {
        cols: 82,
        rows: 25
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

server.on("listening", () => {
    console.log("listening on", server.address());
    console.log("open demo.html to view the frontend");
});

process.on("exit", () => {
    console.log("killing all processes");

    for (const proc of processes) {
        proc.kill();
    }
});
