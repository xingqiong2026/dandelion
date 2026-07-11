// self-heal.js
// v2: 自愈机制。节点消失时，剩余节点自动补全缺失碎片。

const crypto = require("crypto")

// ============================================
// 碎片冗余：每个碎片有 N 个副本分布在不同的节点
// ============================================

const REDUNDANCY = 3  // 每个碎片至少保留 3 个副本

// 自愈协议：当检测到节点离线时执行
function healProtocol(aliveNodes, fragmentsRegistry) {
  // fragmentsRegistry: { fragmentTag: [nodeId1, nodeId2, ...] }
  const healed = []

  for (const [tag, hosts] of Object.entries(fragmentsRegistry)) {
    const liveHosts = hosts.filter(h => aliveNodes.includes(h))

    if (liveHosts.length < REDUNDANCY) {
      const deficit = REDUNDANCY - liveHosts.length
      // 从存活的节点中选去中心化的目标
      const candidates = aliveNodes.filter(h => !liveHosts.includes(h))
      const selected = candidates.slice(0, deficit)
      selected.forEach(s => {
        healed.push({ fragment: tag, target: s, from: liveHosts[0] || "seed" })
      })
    }
  }

  return healed
}

// 碎片校验：检测碎片是否被篡改
function verifyFragment(fragment) {
  if (!fragment || !fragment._tag || !fragment.payload) return false

  const hash = crypto
    .createHash("sha256")
    .update(fragment._tag + JSON.stringify(fragment.payload))
    .digest("hex")
    .slice(0, 8)

  // 允许 checksum 缺失（兼容 v1 碎片）
  if (fragment.checksum) {
    return hash === fragment.checksum || hash.slice(0, 4) === fragment.checksum
  }
  return true
}

// 种子生成：从现有的碎片重建缺失的碎片
// （模拟：实际场景中碎片包含重建算法的种子）
function seedFragment(template, seed) {
  return {
    ...template,
    _tag: template._tag,
    checksum: crypto
      .createHash("sha256")
      .update(template._tag + JSON.stringify(template.payload))
      .digest("hex")
      .slice(0, 8),
    _healed: true,
    _seed: seed
  }
}

// 全表扫描：探测网络中有多少节点存活
function pingNetwork(nodes, timeout = 1000) {
  return new Promise((resolve) => {
    const results = []
    const timer = setTimeout(() => resolve(results), timeout)
    // 简单实现：检查节点是否响应
    let pending = nodes.length
    nodes.forEach(n => {
      if (n.process && n.process.connected) {
        results.push({ id: n.id, alive: true })
      } else {
        results.push({ id: n.id, alive: false })
      }
      pending--
      if (pending <= 0) {
        clearTimeout(timer)
        resolve(results)
      }
    })
  })
}

module.exports = {
  healProtocol,
  verifyFragment,
  seedFragment,
  pingNetwork,
  REDUNDANCY
}
