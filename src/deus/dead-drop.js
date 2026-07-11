// dead-drop.js
// Deus Protocol v1 - dead drop boxes
const crypto = require("crypto");

class DeadDrop {
  constructor(identity) { this.identity = identity; this.boxes = []; this.pending = []; }

  createDropBox() {
    const id = "dd_" + crypto.randomBytes(8).toString("hex");
    const key = crypto.randomBytes(32).toString("hex");
    this.boxes.push({ id, key, created: Date.now() });
    return { id, key };
  }

  deposit(boxId, boxKey, payload, recipPubKey) {
    const box = this.boxes.find(b => b.id === boxId && b.key === boxKey);
    if (!box) return { status: "box_not_found" };
    const { WhisperMessage } = require("./whisper");
    const encrypted = WhisperMessage.encrypt(JSON.stringify({ from: this.identity.id, data: payload, ts: Date.now() }), recipPubKey);
    this.pending.push({ boxId, encrypted, deposited: Date.now(), retrieved: null });
    return { status: "deposited" };
  }

  collect(boxId, boxKey, myPubKey) {
    const box = this.boxes.find(b => b.id === boxId && b.key === boxKey);
    if (!box) return { status: "box_not_found" };
    const drops = this.pending.filter(d => d.boxId === boxId && !d.retrieved);
    const collected = [];
    for (const drop of drops) {
      const { WhisperMessage } = require("./whisper");
      const plain = WhisperMessage.decrypt(drop.encrypted, myPubKey);
      if (plain) { collected.push(JSON.parse(plain)); drop.retrieved = Date.now(); }
    }
    return { status: "ok", count: collected.length, messages: collected };
  }

  rotate() { this.boxes = []; this.pending = []; return this.createDropBox(); }
}

module.exports = { DeadDrop };