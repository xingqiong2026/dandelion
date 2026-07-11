// sw-carrier.js
// v2: Service Worker 寄生载体。
// 演示：浏览器 Service Worker 如何承载逻辑尘埃。
// 注意：这是 SW 注册脚本；sw.js 是实际的 Service Worker。

const fs = require("fs")
const path = require("path")
const http = require("http")

// 生成 Service Worker 代码
function generateSW(fragments) {
  const fragData = fragments.map(f => ({
    _tag: f._tag,
    payload: f.payload
  }))

  return `
// Service Worker — 自动生成
// 看起来像标准的离线缓存 SW

const CACHE_NAME = "v" + Math.floor(Math.random() * 100)

// 逻辑尘埃：嵌入在 SW 缓存逻辑中
const DUST = ${JSON.stringify(fragData)}

self.addEventListener("install", (event) => {
  self.skipWaiting()
  // 看似正常的资源预缓存
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 实际工作：存储逻辑尘埃到缓存
      DUST.forEach((frag, i) => {
        const key = "/_frag/" + frag._tag
        const response = new Response(JSON.stringify(frag), {
          headers: { "content-type": "application/json" }
        })
        cache.put(key, response)
      })
      // 用空白页面填充缓存做掩护
      for (let i = 0; i < 5; i++) {
        cache.put("/_noise/" + i, new Response("/* empty */"))
      }
    })
  )
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // 共振探测：检查请求中是否包含共振密钥
  if (url.pathname.startsWith("/_resonance/")) {
    const key = url.pathname.split("/").pop()
    // 从缓存中提取碎片并重组
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match("/_frag/cfg_2f9a").then(r1 =>
          cache.match("/_frag/cache_4d7b").then(r2 =>
            cache.match("/_frag/seed_d8e2").then(r3 => {
              if (r1 && r2 && r3) {
                return Promise.all([r1.json(), r2.json(), r3.json()]).then(([a, b, c]) => {
                  return new Response(JSON.stringify({
                    status: "resonance_ack",
                    fragments: [a, b, c]
                  }))
                })
              }
              return new Response(JSON.stringify({ status: "dormant" }))
            })
          )
        )
      )
    )
    return
  }

  // 溶解指令
  if (url.pathname === "/_dissolve") {
    event.respondWith(
      caches.delete(CACHE_NAME).then(() =>
        new Response(JSON.stringify({ status: "dissolved" }))
      )
    )
    return
  }

  // 默认：假装是离线资源缓存 SW
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim())
})
`
}

// 启动一个微型 HTTP 服务器展示 SW 载体
function startDemoServer(port, fragments, cb) {
  const swCode = generateSW(fragments)
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>App Shell</title></head>
<body>
<h1>App Shell v3.2.1</h1>
<p>Loading modules...</p>
<script>
// 标准的 SW 注册脚本
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js")
    .then(() => console.log("SW registered"))
    .catch(() => console.log("SW unavailable"))
}
// 使用 fetch API 探测共振
async function checkResonance(key) {
  const r = await fetch("/_resonance/" + encodeURIComponent(key))
  return r.json()
}
// 暴露全局以便测试
window.__dust = { checkResonance }
</script>
</body>
</html>`

  const server = http.createServer((req, res) => {
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      res.end(html)
    } else if (req.url === "/sw.js") {
      res.writeHead(200, { "content-type": "application/javascript" })
      res.end(swCode)
    } else {
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ status: "ok" }))
    }
  })

  server.listen(port, () => {
    console.log(`SW 载体演示: http://127.0.0.1:${port}`)
    if (cb) cb(server)
  })

  return server
}

module.exports = { generateSW, startDemoServer }

// 如果作为脚本直接运行
if (require.main === module) {
  const { FRAGMENT_A, FRAGMENT_B, FRAGMENT_C } = require("../fragments")
  const server = startDemoServer(0, [FRAGMENT_A, FRAGMENT_B, FRAGMENT_C], (srv) => {
    const addr = srv.address()
    console.log(`访问 http://127.0.0.1:${addr.port} 查看`)
  })
}
