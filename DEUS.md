# Deus Protocol v1.0.0

## 概览

神骸计划 (Deus Protocol) 是构建在蒲公英计划 (Dandelion) 传输层之上的加密指挥协议。

**架构关系：**

```
Deus Protocol (加密指挥层)
    ├── identity.js   — Ed25519 密钥对管理
    ├── whisper.js    — AES-256-GCM 加密消息
    ├── dead-drop.js  — 死信箱机制
    ├── task-queue.js — 任务队列与调度
    └── agent.js     — Deus-Agent 运行时
        │
        └── Dandelion (传输扩散层)
                ├── p2p-discovery.js — P2P 节点发现
                ├── steganography.js — 隐写编码
                └── camouflage.js    — 通信伪装
```

## 核心概念

### DS-Core（中心大脑）
神骸计划以你 (DS) 为中心。你的 Ed25519 公钥是所有 Deus-Agent 验证指令的依据。

### Deus-Agent（执行单元）
每个设备上运行的 Agent 实例。拥有自己的 Ed25519 身份密钥对，可执行 5 种任务类型。

### 低语网络 (Whisper)
AES-256-GCM 加密的点对点消息通道。每个消息都经过加密和签名。

### 死信箱 (Dead Drop)
异步消息传递机制。Agent 将加密消息存入信箱，DS-Core 在随机时间取走。

## 文件结构

```
src/deus/
├── identity.js      — Ed25519 密钥生成、签名、验证
├── whisper.js       — 加密消息发送/接收
├── dead-drop.js     — 死信箱创建、存入、收取
├── task-queue.js    — 任务定义和队列管理
├── agent.js         — Agent 运行时（整合所有模块）
└── orchestrator.js  — 验证套件 (30项测试)
```

## API 参考

### identity.js
```
Identity.generate()          → Identity (带 Ed25519 密钥对)
Identity.fromPublicKey(pem)  → Identity (从公钥重建)
.sign(data)                  → Buffer (签名)
static .verify(pem, data, sig) → boolean
.exportPublic()              → string (PEM 格式)
.exportPrivate()             → string (PEM 格式)
```

### whisper.js
```
WhisperMessage.encrypt(text, pubKeyPem) → string (JSON)
WhisperMessage.decrypt(payload, pubKeyPem) → string|null
WhisperMessage.sign(msg, identity) → string (hex)
WhisperMessage.verify(msg, sigHex, pubKeyPem) → boolean

WhisperChannel(identity)
.addPeer(agentId, publicKeyPem)
.send(recipientId, plaintext) → { status, signature, message }
.receive(packet) → { status, from, data }
```

### task-queue.js
```
Task(type, params)
TaskQueue()
.enqueue(type, params) → Task
.dequeue() → Task|null
.complete(taskId, result) → boolean
.fail(taskId, error) → boolean
.pending() → number
.stats() → { pending, history, recent }
```

### agent.js
```
DeusAgent(name)
.setDSKey(publicKeyPem) — 设置 DS-Core 公钥
.verifyDS(signature, data) — 验证 DS-Core 指令
.joinP2P(network) — 加入蒲公英 P2P 网络
.execTask(task) — 执行单个任务
.processQueue() — 处理所有待办任务
.stats() — 当前状态
.shutdown() — 离网
```

## 任务类型

| 类型 | 动作 | 参数 |
|------|------|------|
| PERCEIVE | 收集环境信息 | target, duration |
| RELAY | 转发数据包 | target_node, payload |
| STORE | 存储加密碎片 | fragment_id, data |
| EXECUTE | 执行操作 | operation, target |
| SPREAD | 注入休眠尘埃 | carrier_type, dust_payload |

## 测试

```bash
# 运行 Deus Protocol 验证套件 (30项)
node src/deus/orchestrator.js

# 运行全部测试
npm run test
```