// whisper.js
// Deus Protocol v1 - encrypted messaging
const crypto = require("crypto");
const { Identity } = require("./identity");

class WhisperMessage {
  static encrypt(plaintext, pubKeyPem) {
    const nonce = crypto.randomBytes(12);
    const key = crypto.createHash("sha256").update(pubKeyPem).digest();
    const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
    let enc = cipher.update(plaintext, "utf-8", "hex");
    enc += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");
    return JSON.stringify({ v: 1, c: enc, n: nonce.toString("hex"), t: tag, ts: Date.now() });
  }

  static decrypt(payload, pubKeyPem) {
    try {
      const p = JSON.parse(payload);
      const key = crypto.createHash("sha256").update(pubKeyPem).digest();
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(p.n, "hex"));
      decipher.setAuthTag(Buffer.from(p.t, "hex"));
      let d = decipher.update(p.c, "hex", "utf-8");
      d += decipher.final("utf-8");
      return d;
    } catch (e) { return null; }
  }

  static sign(msg, identity) {
    return identity.sign(msg).toString("hex");
  }

  static verify(msg, sigHex, pubKeyPem) {
    return Identity.verify(pubKeyPem, msg, Buffer.from(sigHex, "hex"));
  }
}

class WhisperChannel {
  constructor(identity) {
    this.identity = identity;
    this.peers = new Map();
  }

  addPeer(agentId, publicKeyPem) {
    this.peers.set(agentId, publicKeyPem);
  }

  send(recipientId, plaintext) {
    const pubKey = this.peers.get(recipientId);
    if (!pubKey) return { status: "peer_unknown" };
    const msg = WhisperMessage.encrypt(plaintext, pubKey);
    const signed = JSON.stringify({ from: this.identity.id, payload: msg, ts: Date.now() });
    const sig = WhisperMessage.sign(signed, this.identity);
    return { status: "sent", from: this.identity.id, to: recipientId, signature: sig, message: signed };
  }

  receive(packet) {
    try {
      const p = JSON.parse(packet.message);
      const senderKey = this.peers.get(p.from);
      if (!senderKey) return { status: "unknown_sender" };
      if (!WhisperMessage.verify(packet.message, packet.signature, senderKey)) return { status: "bad_signature" };
      const plain = WhisperMessage.decrypt(p.payload, this.identity.exportPublic());
      if (!plain) return { status: "decrypt_failed" };
      return { status: "ok", from: p.from, data: plain, ts: p.ts };
    } catch (e) { return { status: "parse_error", error: e.message }; }
  }
}

module.exports = { WhisperMessage, WhisperChannel };