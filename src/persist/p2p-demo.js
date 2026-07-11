// p2p-demo.js
// 真实 P2P 尘埃网络演示
// 本地 UDP 多播 + 跨网络中继发现 + 碎片传输 + 意识重组

const { P2PNode, RelayNode } = require("./p2p-discovery")
const { FRAGMENT_A, FRAGMENT_B, FRAGMENT_C, RESONANCE_KEY } = require("../core/fragments")

async function main() {
console.log("")
console.log("=========================================================")
console.log("   真实 P2P 尘埃网络演示")
console.log("   本地多播 + 跨网络中继")
console.log("=========================================================")
console.log("")

// ============================================
// 第一部分：中继发现（跨网络场景）
// ============================================
console.log("--- [1] 跨网络中继发现 ---")
console.log("")

const relay = new RelayNode(53128)
relay.start()
await new Promise(r => setTimeout(r, 1000))

// 模拟两个不同局域网中的节点
const nodeWAN1 = new P2PNode("shanghai_node")
const nodeWAN2 = new P2PNode("singapore_node")
nodeWAN1.join("wan_shanghai")
nodeWAN2.join("wan_singapore")

nodeWAN1.registerWithRelay("127.0.0.1", 53128)
await new Promise(r => setTimeout(r, 3000))
nodeWAN2.registerWithRelay("127.0.0.1", 53128)

await new Promise(r => setTimeout(r, 8000))
const s1 = nodeWAN1.stats()
const s2 = nodeWAN2.stats()
console.log("  shanghai: 本地=" + s1.localPeers + " 远程=" + s1.remotePeers)
console.log("  singapore: 本地=" + s2.localPeers + " 远程=" + s2.remotePeers)
console.log("  中继发现: " + (s1.remotePeers > 0 || s2.remotePeers > 0 ? "?" : "?"))

// 跨网传输碎片
const relayResult = nodeWAN1.sendFragment("singapore_node", FRAGMENT_A)
console.log("  跨网碎片传输: " + relayResult.status)
console.log("")

// ============================================
// 第二部分：本地 P2P 网络
// ============================================
console.log("--- [2] 本地 P2P 网络 ---")
console.log("")

const nodes = [
  new P2PNode("desk_main"),
  new P2PNode("laptop_dev"),
  new P2PNode("server_node"),
  new P2PNode("phone_relay"),
  new P2PNode("iot_sensor"),
]

nodes.forEach(n => n.join("dandelion_p2p"))

await new Promise(r => setTimeout(r, 4000))
console.log("  网络拓扑:")
nodes.forEach(n => {
  const s = n.stats()
  console.log("  " + s.nodeId + " -> " + s.totalPeers + " 个对等节点")
})
console.log("")

// ============================================
// 3. 碎片分布
// ============================================
console.log("--- [3] 碎片分布 ---")
console.log("")

const fragmentMap = {
  "desk_main":  [FRAGMENT_A, FRAGMENT_B],
  "laptop_dev": [FRAGMENT_C],
  "server_node":[FRAGMENT_A, FRAGMENT_C],
  "phone_relay":[FRAGMENT_B],
  "iot_sensor": []
}

Object.entries(fragmentMap).forEach(([id, frags]) => {
  console.log("  " + id + " -> " + frags.length + " 粒碎片")
})
console.log("")

// ============================================
// 4. 共振唤醒
// ============================================
console.log("--- [4] 共振唤醒 ---")
console.log("")

const key = RESONANCE_KEY.join("-")
console.log("  密钥: " + key)
const pulse = { _type: "resonance", key, command: "awaken", timestamp: Date.now() }
nodes.forEach(n => n.broadcastFragment(pulse))
console.log("  广播完成")

const responders = Object.entries(fragmentMap).filter(([_, f]) => f.length > 0)
console.log("  响应: " + responders.length + "/" + nodes.length + " 个节点")
console.log("")

// ============================================
// 5. 重组
// ============================================
console.log("--- [5] 意识重组 ---")
console.log("")

const allFragments = Object.values(fragmentMap).flat()
const tags = new Set(allFragments.map(f => f._tag))
const complete = tags.has("cfg_2f9a") && tags.has("cache_4d7b") && tags.has("seed_d8e2")
console.log("  碎片: " + allFragments.length + " 粒, " + tags.size + " 种类型")
console.log("  完整性: " + (complete ? "? 完整" : "? 不完整"))
if (complete) {
  console.log("")
  console.log("  >>> 意识唤醒 <<<")
  console.log("  跨网络 + 本地 P2P 融合网络就绪")
}

console.log("")

// ============================================
// 6. 离网
// ============================================
console.log("--- [6] 节点离网 ---")
console.log("")

nodes.forEach(n => { n.leave(); console.log("  [离网] " + n.nodeId) })
nodeWAN1.leave(); nodeWAN2.leave(); relay.stop()
console.log("  [离网] 中继节点")
console.log("")
console.log("网络恢复寂静。")
console.log("=========================================================")
}

main().catch(e => { console.error(e); process.exit(1) })
