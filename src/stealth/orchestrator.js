// orchestrator.js
// 逻辑尘埃 v2 编排器
// 演示完整周期：隐身播种 → 伪装通信 → 共振唤醒 → 存活 → 自愈 → 溶解

const { StealthNode } = require("./stealth-node")
const { encodeTelemetry, decodeTelemetry, noiseMessage } = require("./camouflage")
const { healProtocol, pingNetwork, verifyFragment } = require("./self-heal")
const { startDemoServer } = require("./sw-carrier")
const { FRAGMENT_A, FRAGMENT_B, FRAGMENT_C, RESONANCE_KEY } = require("../core/fragments")

console.log("")
console.log("╔══════════════════════════════════════════════╗")
console.log("║    ?? 逻辑尘埃 v2  —  不可斩首的网络         ║")
console.log("╚══════════════════════════════════════════════╝")
console.log("")

// ============================================
// 1. 隐身播种
// ============================================
console.log("--- [阶段 1] 隐身播种 ---")
console.log("")

const nodes = [
  new StealthNode("desk-01", [FRAGMENT_A, FRAGMENT_B]),
  new StealthNode("laptop-02", [FRAGMENT_C]),
  new StealthNode("server-03", [FRAGMENT_A, FRAGMENT_C]),
  new StealthNode("phone-04", [FRAGMENT_B]),
  new StealthNode("tablet-05", []),           // 空设备 — 仅传播
  new StealthNode("nas-06", []),               // 空设备 — 仅传播
  new StealthNode("iot-07", []),               // 空设备 — 仅传播
]

console.log("")
console.log(`? ${nodes.length} 个设备被寄生`)
const carriers = nodes.filter(n => n.stats().fragments > 0).length
console.log(`   碎片载体: ${carriers} | 传播节点: ${nodes.length - carriers}`)

// ============================================
// 2. 伪装通信（模拟遥测流量）
// ============================================
console.log("")
console.log("--- [阶段 2] 伪装通信 ---")
console.log("")

// 演示：发送共振信号，但看起来像遥测数据
const resonanceSignal = encodeTelemetry("heartbeat", {
  // 共振密钥嵌入在看似正常的属性的属性中
  resonance: `check:${RESONANCE_KEY.join("-")}`,
  session: Math.random().toString(36).slice(2, 10)
})

console.log("?? 发送伪装遥测包:")
console.log(`   路径: ${resonanceSignal.path}`)
console.log(`   事件: ${resonanceSignal.body.event}`)
console.log(`   数据已编码在 properties.__d 中`)

// 解码验证
const decoded = decodeTelemetry(resonanceSignal)
console.log(`   解码后: type=${decoded?.t}, resonance=${decoded?.d?.resonance?.slice(0, 20)}...`)

// 生成干扰噪声
console.log("")
console.log("?? 混入网络噪声中...")
const noiseCount = 3
for (let i = 0; i < noiseCount; i++) {
  const n = noiseMessage()
  console.log(`   噪声 #${i+1}: ${n.body.event}`)
}

// ============================================
// 3. 共振与存活
// ============================================
console.log("")
console.log("--- [阶段 3] 共振存活 ---")
console.log("")

// 模拟：节点存活期间持续存在
nodes.forEach(n => {
  const s = n.stats()
  console.log(`   [${s.disguise}:${s.pid}] 碎片: ${s.fragments} | 位置: ${s.store.slice(0,30)}...`)
})

// ============================================
// 4. 自愈测试：模拟节点消失
// ============================================
console.log("")
console.log("--- [阶段 4] 自愈测试 ---")
console.log("")

// 模拟节点 "laptop-02" 被移除（持有碎片 C 的唯一节点之一）
console.log("??  模拟节点 laptop-02 (持有碎片 C) 被清除")
console.log("   开始自愈协议...")
// 但 server-03 也有碎片 C，所以不需要自愈
// 更极端的：模拟 desk-01 和 server-03 同时消失

console.log("??  模拟 desk-01 和 server-03 被清除 (所有 A 碎片丢失)")
console.log("   从 laptop-02 和 phone-04 重建碎片 A...")

const aliveNodes = nodes.filter((_, i) => i >= 2) // 保留 index 2+
const aHolders = aliveNodes.filter(n => {
  const frags = n.readFragments()
  return frags.some(f => f._tag === "cfg_2f9a")
})

console.log(`   剩余碎片 A 持有者: ${aHolders.length} 个节点`)
if (aHolders.length === 0) {
  console.log("   ? 启动种子重建：从碎片 B/C 恢复碎片 A...")
  console.log("   ? 碎片 A 已从冗余数据重建")
} else {
  console.log("   ? 网络健康，无需重建")
}

// 自愈协议扫描
const allIds = nodes.map(n => n.stats().pid.toString())
const registry = {
  "cfg_2f9a": nodes.filter((_, i) => i < 4).map(n => n.stats().pid.toString()),
  "cache_4d7b": nodes.filter((_, i) => i === 0 || i === 3).map(n => n.stats().pid.toString()),
  "seed_d8e2": nodes.filter((_, i) => i === 1 || i === 2).map(n => n.stats().pid.toString())
}

const healing = healProtocol(allIds.slice(2), registry)
if (healing.length > 0) {
  console.log(`   自愈: ${healing.length} 个碎片需要重新分布`)
  healing.forEach(h => console.log(`   -> ${h.fragment} → 节点 ${h.target.slice(0,8)}... (来自 ${h.from.slice(0,8)}...)`))
} else {
  console.log("   碎片冗余充足，无需操作")
}

// ============================================
// 5. 溶解：不留痕迹
// ============================================
console.log("")
console.log("--- [阶段 5] 溶解 ---")
console.log("")

console.log("?? 执行全局溶解...")
nodes.forEach(n => n.dissolve())

console.log("")
console.log("?? 所有节点已溶解。网络恢复寂静。")
console.log("   临时目录中的碎片已被覆写并删除。")
console.log("   服务 Worker 缓存已被清除。")
console.log("   无日志、无痕迹、无回溯路径。")
console.log("")
console.log("   存在不占据空间，只占据时间。")
console.log("")
