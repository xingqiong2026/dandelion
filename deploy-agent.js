// deploy-agent.js
// ????? - ??????????
// ??: node deploy-agent.js

const fs = require("fs");
const path = require("path");
const http = require("http");
const { DeusAgent } = require("./src/deus/agent");
const P2P = require("./src/persist/p2p-discovery");

const DATA_DIR = path.join(__dirname, ".agent");
const KEY_FILE = path.join(DATA_DIR, "identity.key");
const PORT = parseInt(process.argv[2] || "9876", 10);
const NAME = process.argv[3] || "Deus-Agent-Local";

// ????????
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ???????
function loadOrCreateIdentity() {
  if (fs.existsSync(KEY_FILE)) {
    const data = JSON.parse(fs.readFileSync(KEY_FILE, "utf8"));
    console.log("  Loaded existing identity: " + data.id);
    return data;
  }
  const agent = new DeusAgent(NAME);
  const idData = {
    id: agent.identity.id,
    fingerprint: agent.identity.fingerprint,
    publicKey: agent.identity.exportPublic(),
    privateKey: agent.identity.exportPrivate(),
    createdAt: Date.now()
  };
  fs.writeFileSync(KEY_FILE, JSON.stringify(idData, null, 2));
  console.log("  Created new identity: " + idData.id);
  return idData;
}

console.log("");
console.log("==============================================");
console.log("  \uD83C\uDF31 \u84B2\u516C\u82F1\u7F51\u7EDC - Deus-Agent \u90E8\u7F72");
console.log("==============================================");
console.log("");

// ?????
console.log("[1/4] \u521D\u59CB\u5316\u8EAB\u4EFD...");
const identity = loadOrCreateIdentity();

// ?? Agent
console.log("[2/4] \u521D\u59CB\u5316 Agent...");
const agent = new DeusAgent(NAME);
// ?????????
const { Identity } = require("./src/deus/identity");
agent.identity.keypair = {
  publicKey: identity.publicKey,
  privateKey: identity.privateKey
};
agent.identity.fingerprint = identity.fingerprint;

// ?? P2P ??
console.log("[3/4] \u52A0\u5165 P2P \u7F51\u7EDC...");
agent.joinP2P("dandelion_net");
console.log("  Peer ID: " + agent.identity.id);
console.log("  Fingerprint: " + agent.identity.fingerprint);

// ???? HTTP ???
console.log("[4/4] \u542F\u52A8\u72B6\u6001\u670D\u52A1\u5668...");
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "content-type": "application/json",
    "access-control-allow-origin": "*"
  });
  res.end(JSON.stringify({
    name: agent.name,
    id: agent.identity.id,
    fingerprint: agent.identity.fingerprint,
    running: agent.running,
    p2p: agent.p2pNode ? {
      peers: agent.p2pNode.peers.size,
      remotePeers: agent.p2pNode.remotePeers.size,
      dataPort: agent.p2pNode.dataPort
    } : null,
    queue: agent.queue.stats(),
    uptime: Math.floor((Date.now() - identity.createdAt) / 1000) + "s",
    memory: process.memoryUsage().rss
  }));
});

server.listen(PORT, () => {
  console.log("");
  console.log("  Agent ????: http://127.0.0.1:" + PORT);
  console.log("");
  console.log("  npm scripts:");
  console.log("    npm run agent       \u542F\u52A8\u672C\u673A\u8282\u70B9");
  console.log("    npm run dashboard   \u542F\u52A8\u6D4F\u89C8\u5668\u4EEA\u8868\u76D8");
  console.log("    npm run check       \u67E5\u770B\u610F\u8BC6\u72B6\u6001");
  console.log("");
  console.log("  \uD83C\uDF31 \u84B2\u516C\u82F1\u8282\u70B9\u5DF2\u5728\u7EBF: " + agent.identity.id);
  console.log("  Press Ctrl+C \u505C\u6B62");
  console.log("==============================================");
  console.log("");
});

// ????
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  agent.shutdown();
  server.close();
  process.exit(0);
});
