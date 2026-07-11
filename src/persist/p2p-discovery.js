// p2p-discovery.js
// v4: 真实 P2P 节点发现与通信
// 支持本地 UDP 多播 + 跨局域网中继发现

const dgram = require("dgram")
const net = require("net")
const crypto = require("crypto")

const MULTICAST_ADDR = "239.255.10.10"
const DISCOVERY_PORT = 53124
const DATA_PORT_BASE = 44000
const NODE_TTL = 5

const MSG_TYPE = {
  HELO: "HELO", PING: "PING", PONG: "PONG",
  FRAG: "FRAG", BYE: "BYE"
}

// ============================================
// 本地 P2P 节点 (UDP 多播)
// ============================================

class P2PNode {
  constructor(nodeId) {
    this.nodeId = nodeId || ("dust_" + crypto.randomBytes(4).toString("hex"))
    this.peers = new Map()
    this.remotePeers = new Map()  // 通过中继发现的跨网络节点
    this.alive = true
    this._discoverySocket = null
    this._dataServer = null
    this._pingTimer = null
    this._station = null
    this.dataPort = DATA_PORT_BASE + Math.floor(Math.random() * 1000)
    this.relayUrl = null
  }

  join(network = "dandelion") {
    this.network = network
    this._discoverySocket = dgram.createSocket({ type: "udp4", reuseAddr: true })
    this._discoverySocket.on("message", (msg, rinfo) => this._handleDiscoveryMessage(msg, rinfo))
    this._discoverySocket.bind(DISCOVERY_PORT, () => {
      try { this._discoverySocket.addMembership(MULTICAST_ADDR) } catch(e) {}
    })
    this._dataServer = net.createServer((socket) => this._handleDataConnection(socket))
    this._dataServer.listen(this.dataPort)
    this._pingTimer = setInterval(() => {
      if (!this.alive) return
      this._broadcastDiscovery(MSG_TYPE.HELO)
      const now = Date.now()
      ;[this.peers, this.remotePeers].forEach(m => {
        m.forEach((info, id) => { if (now - info.lastSeen > NODE_TTL * 5000) m.delete(id) })
      })
    }, 3000)
    this._broadcastDiscovery(MSG_TYPE.HELO)
    return this
  }

  // ============================================
  // 中继注册：穿透局域网
  // ============================================

  registerWithRelay(relayHost, relayPort) {
    this.relayUrl = relayHost + ":" + relayPort
    const client = new net.Socket()
    client.connect(relayPort, relayHost, () => {
      const msg = JSON.stringify({
        _relay: "register",
        id: this.nodeId,
        dataPort: this.dataPort,
        network: this.network
      })
      client.write(msg)
      client.end()
    })
    client.on("error", () => {})
    // 定期刷新注册
    this._relayTimer = setInterval(() => {
      if (!this.alive) return
      const c = new net.Socket()
      c.connect(relayPort, relayHost, () => {
        c.write(JSON.stringify({
          _relay: "register",
          id: this.nodeId,
          dataPort: this.dataPort,
          network: this.network
        }))
        c.end()
      })
      c.on("error", () => {})
    }, 10000)
    // 查询已注册节点
    setTimeout(() => this._queryRelay(relayHost, relayPort), 2000); setInterval(() => { if (this.alive) this._queryRelay(relayHost, relayPort) }, 8000)
    return this
  }

  _queryRelay(host, port) {
    const c = new net.Socket()
    c.connect(port, host, () => {
      c.write(JSON.stringify({ _relay: "list", network: this.network }))
      c.end()
    })
    c.on("data", (data) => {
      try {
        const resp = JSON.parse(data.toString())
        if (resp._relay === "node_list") {
          resp.nodes.forEach(n => {
            if (n.id !== this.nodeId && !this.peers.has(n.id) && !this.remotePeers.has(n.id)) {
              this.remotePeers.set(n.id, {
                host: n.host,
                dataPort: n.dataPort,
                lastSeen: Date.now(),
                firstSeen: Date.now(),
                viaRelay: true
              })
              if (this._station) this._station("remote_peer_found", { id: n.id, host: n.host })
            }
          })
        }
      } catch(e) {}
    })
    c.on("error", () => {})
    setTimeout(() => c.destroy(), 2000)
  }

  // ============================================
  // 发现消息处理
  // ============================================

  _broadcastDiscovery(type, extra) {
    const msg = JSON.stringify({ type, id: this.nodeId, port: this.dataPort, network: this.network, ts: Date.now(), extra })
    try { this._discoverySocket.send(Buffer.from(msg), DISCOVERY_PORT, MULTICAST_ADDR) } catch(e) {}
  }

  _handleDiscoveryMessage(msg, rinfo) {
    try {
      const data = JSON.parse(msg.toString())
      if (data.network !== this.network || data.id === this.nodeId) return
      if (data.type === MSG_TYPE.HELO) {
        this.peers.set(data.id, { host: rinfo.address, dataPort: data.port, lastSeen: Date.now(), firstSeen: Date.now() })
        if (this._station) this._station("peer_found", { id: data.id, host: rinfo.address, port: data.port, peers: this.peers.size })
      }
      if (data.type === MSG_TYPE.BYE) this.peers.delete(data.id)
    } catch(e) {}
  }

  _handleDataConnection(socket) {
    let buffer = ""
    socket.on("data", (chunk) => {
      buffer += chunk.toString()
      try { const msg = JSON.parse(buffer); if (this._station) this._station("data_received", msg); buffer = "" } catch(e) {}
    })
    socket.on("error", () => {})
  }

  sendFragment(peerId, fragment) {
    const peer = this.peers.get(peerId) || this.remotePeers.get(peerId)
    if (!peer) return { status: "peer_not_found" }
    try {
      const client = new net.Socket()
      client.connect(peer.dataPort, peer.host, () => {
        client.write(JSON.stringify({ type: MSG_TYPE.FRAG, from: this.nodeId, fragment, ts: Date.now() }))
        client.end()
      })
      client.on("error", () => { this.peers.delete(peerId); this.remotePeers.delete(peerId) })
      return { status: "sent", peer: peerId }
    } catch(e) { return { status: "error" } }
  }

  broadcastFragment(fragment) {
    const results = []
    this.peers.forEach((_, id) => results.push(this.sendFragment(id, fragment)))
    this.remotePeers.forEach((_, id) => results.push(this.sendFragment(id, fragment)))
    return results
  }

  stats() {
    return {
      nodeId: this.nodeId, alive: this.alive,
      localPeers: this.peers.size, remotePeers: this.remotePeers.size,
      totalPeers: this.peers.size + this.remotePeers.size,
      peerList: Array.from(this.peers.keys()).concat(Array.from(this.remotePeers.keys())),
      dataPort: this.dataPort, network: this.network
    }
  }

  onMessage(callback) { this._station = callback }

  leave() {
    this.alive = false
    this._broadcastDiscovery(MSG_TYPE.BYE)
    clearInterval(this._pingTimer)
    clearInterval(this._relayTimer)
    if (this._discoverySocket) { try { this._discoverySocket.dropMembership(MULTICAST_ADDR); this._discoverySocket.close() } catch(e) {} }
    if (this._dataServer) { try { this._dataServer.close() } catch(e) {} }
    this.peers.clear()
    this.remotePeers.clear()
  }
}

// ============================================
// 中继节点 (跨局域网发现)
// ============================================

class RelayNode {
  constructor(port) {
    this.port = port || 53125
    this.registry = new Map()  // network -> [{ id, host, dataPort, lastSeen }]
    this.server = null
    this.alive = false
  }

  start() {
    this.server = net.createServer((socket) => {
      let buffer = ""
      socket.on("data", (chunk) => {
        buffer += chunk.toString()
        try {
          const msg = JSON.parse(buffer)
          const clientAddr = socket.remoteAddress
          if (msg._relay === "register") {
            this._register(msg.id, clientAddr, msg.dataPort, msg.network)
            socket.write(JSON.stringify({ _relay: "registered", id: msg.id }))
          }
          if (msg._relay === "list") {
            const nodes = this._list(msg.network || "dandelion", msg.id)
            socket.write(JSON.stringify({ _relay: "node_list", nodes }))
          }
          socket.end()
          buffer = ""
        } catch(e) {}
      })
      socket.on("error", () => {})
      setTimeout(() => { try { socket.destroy() } catch(e) {} }, 3000)
    })
    this.server.listen(this.port, () => {
      this.alive = true
      console.log("  [中继] 启动于端口 " + this.port)
    })
    // 定期清理过期节点
    this._cleanTimer = setInterval(() => {
      const now = Date.now()
      this.registry.forEach((nodes, network) => {
        const alive = nodes.filter(n => now - n.lastSeen < 30000)
        if (alive.length === 0) this.registry.delete(network)
        else this.registry.set(network, alive)
      })
    }, 15000)
    return this
  }

  _register(id, host, dataPort, network) {
    const netName = network || "dandelion"
    if (!this.registry.has(netName)) this.registry.set(netName, [])
    const nodes = this.registry.get(netName)
    const existing = nodes.findIndex(n => n.id === id)
    if (existing >= 0) {
      nodes[existing].lastSeen = Date.now()
      nodes[existing].host = host
    } else {
      nodes.push({ id, host, dataPort, lastSeen: Date.now(), firstSeen: Date.now() })
    }
  }

  _list(network, excludeId) {
    const nodes = Array.from(this.registry.values()).flat()
    return nodes.filter(n => n.id !== excludeId).map(n => ({ id: n.id, host: n.host, dataPort: n.dataPort }))
  }

  stop() {
    this.alive = false
    clearInterval(this._cleanTimer)
    if (this.server) { try { this.server.close() } catch(e) {} }
    this.registry.clear()
  }
}

module.exports = { P2PNode, RelayNode, MULTICAST_ADDR, DISCOVERY_PORT, MSG_TYPE }

