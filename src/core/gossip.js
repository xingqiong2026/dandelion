// gossip.js
// 去中心化 Gassip 协议：节点之间广播信息，无中心枢纽

const EventEmitter = require('events')

class GossipChannel extends EventEmitter {
  constructor(nodeId) {
    super()
    this.nodeId = nodeId
    this._messageLog = []
    this._port = null
  }

  join(port) {
    this._port = port
    if (port && typeof port.on === 'function') {
      port.on('message', (msg) => this._receive(msg))
    }
    return this
  }

  broadcast(type, data) {
    const message = {
      _gossip: true,
      _id: this.nodeId + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type,
      from: this.nodeId,
      data,
      timestamp: Date.now(),
      ttl: 3
    }

    // 通过 IPC 发送给父进程（由父进程转发到所有子进程）
    if (this._port && typeof this._port.send === 'function') {
      try { this._port.send(message) } catch(e) {}
    }

    // 本地也触发事件（用于单进程测试）
    this._receive(message)
    return message
  }

  _receive(msg) {
    if (!msg || !msg._gossip) return
    if (msg.ttl <= 0) return
    if (this._messageLog.includes(msg._id)) return

    this._messageLog.push(msg._id)
    if (this._messageLog.length > 500) this._messageLog.shift()

    this.emit(msg.type, msg)
    this.emit('message', msg)
  }

  stats() {
    return {
      nodeId: this.nodeId,
      messagesReceived: this._messageLog.length
    }
  }
}

module.exports = { GossipChannel }
