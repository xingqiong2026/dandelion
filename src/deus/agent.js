// agent.js
// Deus Protocol v1 - Agent runtime
const { Identity } = require("./identity");
const { WhisperChannel } = require("./whisper");
const { DeadDrop } = require("./dead-drop");
const { TaskQueue, TASK_TYPES } = require("./task-queue");
const P2P = require("../persist/p2p-discovery");
const STEGO = require("../penetrate/steganography");

class DeusAgent {
  constructor(name) {
    this.name = name || "Deus-Agent";
    this.identity = new Identity().generate();
    this.whisper = new WhisperChannel(this.identity);
    this.deadDrop = new DeadDrop(this.identity);
    this.queue = new TaskQueue();
    this.p2pNode = null;
    this.dsKey = null;
    this.running = false;
    console.log("Agent " + this.name + " [" + this.identity.id + "] init");
  }

  setDSKey(pem) {
    this.dsKey = pem;
    const v = Identity.fromPublicKey(pem);
    console.log("DS-Core fingerprint: " + v.fingerprint);
  }

  verifyDS(sig, data) {
    return this.dsKey ? Identity.verify(this.dsKey, data, sig) : false;
  }

  joinP2P(network) {
    this.p2pNode = new P2P.P2PNode("deus_" + this.identity.fingerprint);
    this.p2pNode.join(network || "deus_net");
    this.p2pNode.onMessage((type, data) => {
      if (type === "data_received" && data.type === "FRAG") this.queue.enqueue(TASK_TYPES.STORE, { fragment: data.fragment });
      if (type === "peer_found") console.log("  peer: " + data.id);
    });
    console.log("  P2P joined: " + network);
    return this;
  }

  execTask(task) {
    switch (task.type) {
      case TASK_TYPES.PERCEIVE:
        return { ok: true, data: { mem: process.memoryUsage(), uptime: process.uptime(), node: process.version } };
      case TASK_TYPES.STORE:
        return { ok: true, stored: task.params.fragment ? task.params.fragment._tag || "?" : "none" };
      case TASK_TYPES.SPREAD:
        try {
          const s = new STEGO.SteganographyEncoder();
          const enc = s.encodeAll(task.params.fragment || {});
          return { ok: true, encoded: Object.keys(enc).length };
        } catch (e) { return { ok: false, error: e.message }; }
      case TASK_TYPES.RELAY:
        if (this.p2pNode && task.params.target) {
          const r = this.p2pNode.sendFragment(task.params.target, task.params.payload);
          return { ok: r.status === "sent", result: r };
        }
        return { ok: false, error: "no_p2p" };
      default:
        return { ok: false, error: "unknown_task_type: " + task.type };
    }
  }

  processQueue() {
    let count = 0;
    while (this.queue.pending() > 0) {
      const task = this.queue.dequeue();
      if (!task) break;
      try { this.queue.complete(task.id, this.execTask(task)); count++; }
      catch (e) { this.queue.fail(task.id, e.message); }
    }
    return count;
  }

  stats() {
    return {
      id: this.identity.id,
      fp: this.identity.fingerprint,
      p2p: this.p2pNode ? this.p2pNode.stats() : null,
      queue: this.queue.stats(),
      ds: !!this.dsKey
    };
  }

  shutdown() {
    if (this.p2pNode) this.p2pNode.leave();
    this.running = false;
    console.log("Agent " + this.name + " shutdown");
  }
}

module.exports = { DeusAgent };