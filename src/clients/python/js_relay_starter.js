// js_relay_starter.js
// 启动 JS 中继用于跨语言互通测试
// 由 Python 测试调用

const net = require("net");

const PORT = parseInt(process.argv[2] || "53129");

const server = net.createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
        buffer += chunk.toString();
        try {
            const msg = JSON.parse(buffer);
            const clientAddr = socket.remoteAddress;

            if (msg._relay === "register") {
                const response = JSON.stringify({ _relay: "registered", id: msg.id });
                socket.write(response);
                console.log(JSON.stringify({
                    event: "registered",
                    id: msg.id,
                    host: clientAddr,
                    dataPort: msg.dataPort,
                    network: msg.network
                }));
            } else if (msg._relay === "list") {
                console.log(JSON.stringify({
                    event: "list_request",
                    network: msg.network,
                    from: msg.id
                }));
                socket.write(JSON.stringify({ _relay: "node_list", nodes: [] }));
            }
            socket.end();
            buffer = "";
        } catch (e) { /* continue buffering */ }
    });
    socket.on("error", () => {});
    setTimeout(() => { try { socket.destroy(); } catch(e) {} }, 3000);
});

server.listen(PORT, () => {
    console.log(JSON.stringify({ event: "started", port: PORT }));
});

process.on("SIGINT", () => {
    server.close();
    process.exit(0);
});

// Keep running
setInterval(() => {}, 1000);
