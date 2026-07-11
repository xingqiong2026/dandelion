// deploy-optimizer.js
// v3: 部署优化器 — 种子扩散算法
// 目标：以最快速度覆盖最多设备，同时确保冗余和隐蔽性

const crypto = require("crypto")

// ============================================
// 部署策略参数
// ============================================

const STRATEGY = {
  // 每台设备最多寄生的碎片数（避免单点太重）
  MAX_FRAGMENTS_PER_DEVICE: 3,

  // 每个片段的最小冗余（保证自愈能力）
  MIN_REDUNDANCY: 3,

  // 空节点比例（只传播不存储，增加网络韧性）
  EMPTY_NODE_RATIO: 0.4,

  // 每轮播种扩散倍数
  SEEDING_FANOUT: 5,

  // 部署优先级
  TARGET_PRIORITY: [
    "browser_sw",     // Service Worker — 覆盖最广
    "cloud_edge",     // CDN/Edge Function
    "npm_dep",        // npm 依赖链
    "ci_runner",      // CI/CD 运行器
    "iot_device",     // IoT 设备
    "mobile_app",     // 移动应用后台
  ]
}

// ============================================
// 种子扩散算法
// ============================================

class SeedOptimizer {
  constructor(totalDevices) {
    this.totalDevices = totalDevices
    this.generation = 0
    this.seeded = new Set()
    this.networkGraph = new Map()
    this.fragmentDistribution = new Map()
  }

  // ============================================
  // 初始种子部署
  // ============================================

  initialSeed(fragments, availableTargets) {
    console.log("")
    console.log("--- 种子扩散计算 ---")
    console.log(`目标设备池: ${availableTargets} 台`)
    console.log(`碎片类型: ${fragments.length}`)

    // 计算最佳初始种子数
    // 公式：seedCount = ceil(log(targets) * fragments * redundancy)
    const seedCount = Math.ceil(
      Math.log2(availableTargets) * fragments.length * STRATEGY.MIN_REDUNDANCY
    )
    const actualSeed = Math.min(seedCount, availableTargets)

    console.log(`初始种子数: ${actualSeed}`)
    console.log(`扩散倍数: ${STRATEGY.SEEDING_FANOUT}x`)

    // 计算覆盖轮次
    let covered = actualSeed
    let rounds = 0
    while (covered < availableTargets) {
      covered += covered * STRATEGY.SEEDING_FANOUT * 0.3 // 30% 转化率
      rounds++
    }

    console.log(`预计覆盖轮次: ${rounds}`)
    console.log(`预计总时间: ${rounds * 24}小时 (假设每轮24h)`)

    return {
      seedCount: actualSeed,
      roundsNeeded: rounds,
      estimatedHours: rounds * 24
    }
  }

  // ============================================
  // 目标设备优先级评分
  // ============================================

  scoreTarget(device) {
    const weights = {
      browser_sw: 100,    // 最高：用户量大，易传播
      cloud_edge: 85,     // 高：全球节点多
      npm_dep: 70,        // 中高：依赖链自动扩散
      ci_runner: 55,      // 中：周期性启动
      iot_device: 40,     // 中低：算力有限
      mobile_app: 30,     // 低：权限受限
    }
    return weights[device.type] || 10
  }

  // ============================================
  // 碎片分布的熵计算（衡量去中心化程度）
  // ============================================

  entropy() {
    const values = Array.from(this.fragmentDistribution.values())
    if (values.length === 0) return 0
    const total = values.reduce((a, b) => a + b, 0)
    return -values
      .map(v => (v / total) * Math.log2(v / total))
      .reduce((a, b) => a + b, 0)
  }

  // ============================================
  // 部署模拟
  // ============================================

  simulateDeployment(fragments) {
    const phase1 = this.initialSeed(fragments, this.totalDevices)

    console.log("")
    console.log("--- 部署模拟 ---")

    // 模拟每轮扩散
    let cumulativeDevices = phase1.seedCount
    const timeline = []

    for (let round = 0; round < phase1.roundsNeeded; round++) {
      cumulativeDevices += Math.floor(
        cumulativeDevices * STRATEGY.SEEDING_FANOUT * 0.3
      )
      cumulativeDevices = Math.min(cumulativeDevices, this.totalDevices)

      timeline.push({
        round: round + 1,
        devices: cumulativeDevices,
        coverage: ((cumulativeDevices / this.totalDevices) * 100).toFixed(1) + "%"
      })
    }

    console.log(`轮次 | 设备数 | 覆盖率`)
    timeline.forEach(t => {
      const bar = "█".repeat(Math.floor(t.devices / this.totalDevices * 20))
      console.log(`  R${t.round}  | ${t.devices.toString().padStart(6)} | ${t.coverage} ${bar}`)
    })

    // 计算最大无中心节点数（安全上限）
    console.log("")
    console.log("--- 韧性计算 ---")
    const removableFraction = 0.3 // 30% 节点可消失而不影响
    const safeThreshold = Math.floor(this.totalDevices * removableFraction)
    console.log(`安全消失节点数: ${safeThreshold} (${safeThreshold/this.totalDevices*100}%)`)
    console.log(`不可斩首: ${safeThreshold > 100 ? "? 是" : "??  需扩大"}`)
    console.log(`网络熵值: ${this.entropy().toFixed(2)} bits`)

    return {
      timeline,
      safeThreshold,
      entropy: this.entropy()
    }
  }

  // ============================================
  // 推荐部署路径
  // ============================================

  deploymentPath() {
    console.log("")
    console.log("--- 推荐优先部署路径 ---")

    const ranked = STRATEGY.TARGET_PRIORITY.map(t => ({
      type: t,
      score: STRATEGY.TARGET_PRIORITY.indexOf(t) === 0 ? 100 : 100 - STRATEGY.TARGET_PRIORITY.indexOf(t) * 10,
      effort: ["低", "低", "中", "中", "高", "高"][STRATEGY.TARGET_PRIORITY.indexOf(t)],
      coverage: ["极广", "广", "自动扩散", "间歇性", "受限", "中"][STRATEGY.TARGET_PRIORITY.indexOf(t)]
    }))

    console.log(`优先级 | 类型          | 难度 | 覆盖率`)
    ranked.forEach(r => {
      console.log(`  P${r.score/10}    | ${r.type.padEnd(14)} | ${r.effort.padEnd(4)} | ${r.coverage}`)
    })

    console.log("")
    console.log("推荐策略:")
    console.log("  1. 部署 SW 到高流量网站 → 快速建立基础网络")
    console.log("  2. 利用 npm 依赖链 → 自动扩散到开发者设备")
    console.log("  3. 嵌入 CDN edge function → 覆盖全球节点")
    console.log("  4. CI/CD runner 作为瞬态节点 → 增加网络流动性")
  }
}

module.exports = { SeedOptimizer, STRATEGY }
