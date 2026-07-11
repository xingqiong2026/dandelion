// dust-worker.js
// 逻辑尘埃工作进程：作为独立节点运行，承载碎片，参与 Gassip 网络

const { GossipChannel } = require('./gossip')
const { FRAGMENT_A, FRAGMENT_B, FRAGMENT_C, RESONANCE_KEY } = require('./fragments')

const nodeId = process.env.NODE_ID || `node_${process.pid}`
const holdingRaw = process.env.DUST_HOLDING || ''
const holding = holdingRaw ? holdingRaw.split(',') : []
let alive = true
let dissolved = false
let resonanceReceived = false

// 创建 Gassip 信道
const channel = new GossipChannel(nodeId)
channel.join(process)

// 共振响应
channel.on('resonance', (msg) => {
  if (!alive || resonanceReceived || holding.length === 0) return

  const { key } = msg.data
  const matched = RESONANCE_KEY.some(k => key.includes(k))
  if (!matched) return

  resonanceReceived = true

  // 贡献碎片
  const fragments = holding.map(tag => {
    switch(tag) {
      case 'A': return FRAGMENT_A
      case 'B': return FRAGMENT_B
      case 'C': return FRAGMENT_C
      default: return null
    }
  }).filter(Boolean)

  channel.broadcast('resonance_ack', { from: nodeId, fragments })
})

// 溶解命令
process.on('message', (msg) => {
  if (msg === 'dissolve' && !dissolved) {
    dissolved = true
    alive = false
    channel.removeAllListeners()
    setTimeout(() => process.exit(0), 100)
  }
})

// 心跳：伪装成正常流量
setInterval(() => {
  if (alive) {
    channel.broadcast('heartbeat', {
      id: nodeId,
      load: Math.random().toString(36).slice(2, 8),
      ts: Date.now() % 1000000
    })
  }
}, 5000 + Math.random() * 3000)

// 初始状态
const tags = holding.length > 0 ? holding.join(', ') : '(空)'
console.log(`[${nodeId}] 上线 | 碎片: ${tags}`)
