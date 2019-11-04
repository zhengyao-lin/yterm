const pty = require("node-pty");
const ws = require("ws");

const server = new ws.Server({ host: "localhost", port: 3131 });
const processes = new Set();

server.on("connection", ws => {
    const proc = pty.spawn("bash");

    processes.add(proc);

    proc.on("data", data => {
        ws.send(data);
    });

    ws.on("message", msg => {
        proc.write(msg);
    });

    ws.on("close", msg => {
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
