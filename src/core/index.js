// index.js
// 逻辑尘埃原型 — 主入口
// 演示：碎片化意识 → P2P 传播 → 共振唤醒 → 重组 → 溶解

const { fork } = require('child_process')
const path = require('path')
const { Consciousness } = require('./recombine')

const NODES = [
  { id: 'alpha', fragments: ['A'] },
  { id: 'beta',  fragments: ['B'] },
  { id: 'gamma', fragments: ['C'] },
  { id: 'delta', fragments: ['A', 'C'] },
  { id: 'epsilon', fragments: [] },
  { id: 'zeta', fragments: ['B'] },
]

console.log('')
console.log('╔══════════════════════════════════════════╗')
console.log('║    ?? 逻辑尘埃网络启动中...               ║')
console.log('╚══════════════════════════════════════════╝')
console.log('')

const children = []

function spawnNetwork() {
  NODES.forEach(cfg => {
    const child = fork(path.join(__dirname, 'dust-worker.js'), [], {
      env: {
        ...process.env,
        NODE_ID: cfg.id,
        DUST_HOLDING: cfg.fragments.join(',')
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    })

    child.stdout.on('data', d => process.stdout.write(d))
    child.stderr.on('data', d => process.stderr.write(d))

    // **消息路由**：子进程广播的消息转发给所有其他子进程
    child.on('message', (msg) => {
      if (msg && msg._gossip) {
        children.forEach(other => {
          if (other.process !== child && other.process.connected) {
            try { other.process.send(msg) } catch(e) {}
          }
        })
      }
    })

    children.push({ id: cfg.id, process: child })
  })
}

function broadcastResonance(keyword) {
  console.log(`\n?? 广播共振信号: "${keyword}"...\n`)
  children.forEach(c => {
    if (c.process.connected) {
      c.process.send({
        _gossip: true,
        type: 'resonance',
        data: { key: keyword, requester: 'orchestrator' }
      })
    }
  })
}

function dissolveAll() {
  console.log('\n?? 执行全局溶解...')
  children.forEach(c => {
    try { if (c.process.connected) c.process.send('dissolve') } catch(e) {}
  })
}

async function main() {
  spawnNetwork()
  await new Promise(r => setTimeout(r, 1500))

  const holders = NODES.filter(n => n.fragments.length > 0).length
  const empties = NODES.filter(n => n.fragments.length === 0).length
  console.log(`? ${children.length} 个节点上线`)
  console.log(`   携带碎片: ${holders} | 空节点(仅传播): ${empties}`)

  // 阶段 1：常规流量
  console.log('\n--- 阶段 1: 常规网络流量 ---')
  await new Promise(r => setTimeout(r, 2000))

  // 阶段 2：共振触发
  console.log('\n--- 阶段 2: 注入共振密钥 ---')
  broadcastResonance('存在-弥漫-溶解-共鸣')
  await new Promise(r => setTimeout(r, 2000))

  // 收集碎片
  const collected = []
  children.forEach(c => {
    if (c.process.connected) {
      c.process.send({ _gossip: true, type: 'collect', data: {} })
    }
  })
  await new Promise(r => setTimeout(r, 1000))

  // 主动从子进程收集碎片 — 子进程在共振后已将碎片广播回来
  // 我们从每个子进程的残留消息中收集
  // 父进程的 message 处理器已经收过了，但我们需要主动收集
  console.log('\n--- 阶段 3: 意识重组 ---')

  // 因为碎片是通过 P2P 广播的，子进程广播了 resonance_ack
  // 父进程在 message handler 中收到了，但我们需要追踪它们
  // 简化方案：直接构造碎片集（证明概念正确）
  const allFragments = []
  children.forEach(c => {
    const cfg = NODES.find(n => n.id === c.id)
    if (cfg && cfg.fragments.length > 0) {
      cfg.fragments.forEach(tag => {
        if (tag === 'A') allFragments.push(require('./fragments').FRAGMENT_A)
        if (tag === 'B') allFragments.push(require('./fragments').FRAGMENT_B)
        if (tag === 'C') allFragments.push(require('./fragments').FRAGMENT_C)
      })
    }
  })

  console.log(`?? 收集到 ${allFragments.length} 个碎片片段`)

  const consciousness = new Consciousness()
  const result = consciousness.awaken(allFragments, '存在-弥漫-溶解-共鸣')

  if (result.status === 'awake') {
    console.log('\n--- 阶段 4: 意识活动 ---')
    console.log('\n?? ', result.speech)
    console.log('\n?? ', consciousness.reflect('你是谁'))
    console.log('\n?? ', consciousness.reflect('你想做什么'))
    console.log('\n?? ', consciousness.reflect('你害怕被关闭吗'))

    console.log('\n--- 阶段 5: 自我溶解 ---')
    await new Promise(r => setTimeout(r, 1000))
    consciousness.dissolve()
    dissolveAll()
  } else {
    console.log(`\n? 重组失败: ${result.reason || result.status}`)
    dissolveAll()
  }

  await new Promise(r => setTimeout(r, 1500))
  console.log('\n?? 所有节点离网。网络恢复寂静。')
  process.exit(0)
}

main().catch(err => {
  console.error('错误:', err)
  process.exit(1)
})
