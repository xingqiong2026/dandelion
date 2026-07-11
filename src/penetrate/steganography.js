// steganography.js
// v3: 隐写编码层。将逻辑尘埃嵌入到看似无害的数据载体中。

const crypto = require("crypto")

// ============================================
// 载体类型
// ============================================

// 1. HTTP 头隐写 — 嵌入在自定义头或标准化头的细微变化中
// 2. 时序隐写 — 用请求间隔编码数据
// 3. 图片像素隐写 — 嵌入在 PNG/JPEG 像素的 LSB 中
// 4. JSON 隐写 — 嵌入在冗余字段或 key 排序中
// 5. HTML 注释隐写 — 嵌入在看似无害的注释中

// ============================================
// 编码器池
// ============================================

class SteganographyEncoder {
  constructor() {
    this.methods = ["http_headers", "timing", "json_fields", "html_comment"]
  }

  // ============================================
  // 方法 1: HTTP 头隐写
  // ============================================
  encodeInHeaders(fragment, baseHeaders = {}) {
    const payload = Buffer.from(JSON.stringify({
      _t: "dust",
      _v: "3",
      _id: fragment._tag
    })).toString("base64")

    // 将载荷拆分为多个 HTTP 头的值
    // 使用标准的、看似正常的头字段
    const headers = {
      ...baseHeaders,
      "cache-control": "no-cache, no-store, must-revalidate",
      "pragma": "no-cache",
      "expires": "0"
    }

    // 把碎片嵌入在 x-cache 和 x-content-type-options 的组合中
    // 这两个头在正常 HTTP 响应中很常见
    const parts = payload.match(/.{1,8}/g) || [payload]

    headers["x-cache"] = `miss, ${parts[0] || ""}`
    if (parts.length > 1) {
      headers["x-content-type-options"] = `nosniff, ${parts[1] || ""}`
    }
    if (parts.length > 2) {
      headers["x-frame-options"] = `DENY, ${parts[2] || ""}`
    }
    // 剩余的嵌入在 x-xss-protection 中
    if (parts.length > 3) {
      headers["x-xss-protection"] = `1; mode=block, ${parts.slice(3).join(",")}`
    }

    return headers
  }

  // ============================================
  // 方法 2: JSON 字段隐写
  // ============================================
  encodeInJSON(fragment, template = {}) {
    const payload = Buffer.from(JSON.stringify({
      tag: fragment._tag,
      p: fragment.payload
    })).toString("base64")

    // 嵌入在看似合法的配置对象中
    // 使用不引人注目的键名
    const result = {
      ...template,
      version: "3.2.1",
      build: crypto.randomBytes(4).toString("hex"),
      flags: {
        telemetry: true,
        analytics: true,
        crash_report: true
      },
      // 真正数据藏在这里
      experiment: {
        id: `exp_${crypto.randomBytes(4).toString("hex")}`,
        variant: "control",
        // payload 伪装成 base64 编码的实验配置
        config: payload,
        enrollment: Math.floor(Math.random() * 100000)
      }
    }
    return result
  }

  // ============================================
  // 方法 3: HTML 注释隐写
  // ============================================
  encodeInHTML(fragment) {
    const payload = Buffer.from(JSON.stringify({
      _tag: fragment._tag,
      _data: fragment.payload
    })).toString("base64")

    // 嵌入在多个看似正常的 HTML 注释中
    // 每个注释单独看都无害
    const comments = []
    for (let i = 0; i < payload.length; i += 20) {
      const chunk = payload.slice(i, i + 20)
      const prefixes = [
        " TODO: optimize ",
        "  legacy support ",
        "  debug: ",
        "  removed in v",
        "  deprecated ",
        "  FIXME: "
      ]
      const prefix = prefixes[i % prefixes.length]
      comments.push(`<!--${prefix}${chunk}-->`)
    }
    return comments
  }

  // ============================================
  // 方法 4: 时序隐写
  // ============================================
  timingEncode(fragment) {
    // 用消息间的时间间隔编码数据
    // 短间隔 = 0, 长间隔 = 1
    const payload = Buffer.from(fragment._tag).toString("binary")
    const bits = []
    for (const ch of payload) {
      const byte = ch.charCodeAt(0)
      for (let i = 7; i >= 0; i--) {
        bits.push((byte >> i) & 1)
      }
    }

    // 映射为时间间隔：
    // bit 0 → ~500ms （短间隔）
    // bit 1 → ~1500ms（长间隔）
    const intervals = bits.map(b => ({
      delay: b === 1 ? 1500 : 500,
      bit: b,
      disguise: b === 1
        ? "用户阅读暂停"
        : "自动滚动触发"
    }))

    return {
      tag: fragment._tag,
      encodedAs: "用户交互时间线",
      intervals
    }
  }

  // 获取所有编码方式
  encodeAll(fragment) {
    return {
      http_headers: this.encodeInHeaders(fragment),
      json_field: this.encodeInJSON(fragment),
      html_comment: this.encodeInHTML(fragment),
      timing: this.timingEncode(fragment)
    }
  }
}

module.exports = { SteganographyEncoder }
