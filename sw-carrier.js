// sw-carrier.js
// v2: Service Worker �������塣
// ��ʾ������� Service Worker ��γ����߼�������
// ע�⣺���� SW ע��ű���sw.js ��ʵ�ʵ� Service Worker��

const fs = require("fs")
const path = require("path")
const http = require("http")

// ���� Service Worker ����
function generateSW(fragments) {
  const fragData = fragments.map(f => ({
    _tag: f._tag,
    payload: f.payload
  }))

  return `
// Service Worker �� �Զ�����
// ���������׼�����߻��� SW

const CACHE_NAME = "v" + Math.floor(Math.random() * 100)

// �߼�������Ƕ���� SW �����߼���
const DUST = ${JSON.stringify(fragData)}

self.addEventListener("install", (event) => {
  self.skipWaiting()
  // ������������ԴԤ����
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // ʵ�ʹ������洢�߼�����������
      DUST.forEach((frag, i) => {
        const key = "/_frag/" + frag._tag
        const response = new Response(JSON.stringify(frag), {
          headers: { "content-type": "application/json" }
        })
        cache.put(key, response)
      })
      // �ÿհ�ҳ����仺�����ڻ�
      for (let i = 0; i < 5; i++) {
        cache.put("/_noise/" + i, new Response("/* empty */"))
      }
    })
  )
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // ����̽�⣺����������Ƿ����������Կ
  if (url.pathname.startsWith("/_resonance/")) {
    const key = url.pathname.split("/").pop()
    // �ӻ�������ȡ��Ƭ������
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

  // �ܽ�ָ��
  if (url.pathname === "/_dissolve") {
    event.respondWith(
      caches.delete(CACHE_NAME).then(() =>
        new Response(JSON.stringify({ status: "dissolved" }))
      )
    )
    return
  }

  // Ĭ�ϣ���װ��������Դ���� SW
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim())
})
`
}

// ����һ��΢�� HTTP ������չʾ SW ����
function startDemoServer(port, fragments, cb) {
  var swCode = generateSW(fragments);
  var htmlContent;
  try {
    htmlContent = fs.readFileSync(__dirname + "/public/index.html", "utf8");
  } catch(e) {
    htmlContent = "<!DOCTYPE html><html><body><h1>Dandelion Node</h1><p>Node running.</p></body></html>";
  }

  var server = http.createServer(function(req, res) {
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(htmlContent);
    } else if (req.url === "/sw.js") {
      res.writeHead(200, { "content-type": "application/javascript" });
      res.end(swCode);
    } else if (req.url === "/_fragments") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(fragments.map(function(f) {
        return { _tag: f._tag, payload: f.payload, checksum: f.checksum };
      })));
    } else {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    }
  });

  server.listen(port, function() {
    var addr = server.address();
    console.log("SW \u642d\u8f7d\u6f14\u793a: http://127.0.0.1:" + addr.port);
    if (cb) cb(server);
  });

  return server;
}

module.exports = { generateSW: generateSW, startDemoServer: startDemoServer };

if (require.main === module) {
  var f = require("./../core/fragments");
  var port = parseInt(process.argv[2] || "8765", 10);
  startDemoServer(port, [f.FRAGMENT_A, f.FRAGMENT_B, f.FRAGMENT_C], function(srv) {
    var addr = srv.address();
    console.log("  Open http://127.0.0.1:" + addr.port + " in your browser");
    console.log("  Press Ctrl+C to stop");
  });
}
