// identity.js
// Deus Protocol v1 — Ed25519 identity management
// DS-Core identity verification + Agent identity generation

const crypto = require("crypto");

const ALGO = "ed25519";
const DS_CORE_FINGERPRINT = "ds-core://0xDEADBEEF";

class Identity {
  constructor() {
    this.keypair = null;
    this.fingerprint = null;
  }

  generate() {
    this.keypair = crypto.generateKeyPairSync(ALGO, {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" }
    });
    const pubDer = crypto.createPublicKey(this.keypair.publicKey)
      .export({ format: "der", type: "spki" });
    this.fingerprint = crypto.createHash("sha256")
      .update(pubDer).digest("hex").slice(0, 16);
    return this;
  }

  get id() { return "Deus-Agent-" + this.fingerprint; }

  sign(data) {
    return crypto.sign(null, Buffer.from(data), this.keypair.privateKey);
  }

  static verify(publicKeyPem, data, signature) {
    try {
      return crypto.verify(null, Buffer.from(data), publicKeyPem, signature);
    } catch(e) { return false; }
  }

  static fromPublicKey(pem) {
    const i = new Identity();
    i.keypair = { publicKey: pem };
    const der = crypto.createPublicKey(pem)
      .export({ format: "der", type: "spki" });
    i.fingerprint = crypto.createHash("sha256")
      .update(der).digest("hex").slice(0, 16);
    return i;
  }

  exportPublic() { return this.keypair.publicKey; }
  exportPrivate() { return this.keypair.privateKey; }
}

function verifyDSIdentity(signature, data, dsPublicKey) {
  return Identity.verify(dsPublicKey, data, signature);
}

module.exports = { Identity, DS_CORE_FINGERPRINT, ALGO, verifyDSIdentity };
