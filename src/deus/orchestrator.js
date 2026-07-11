// orchestrator.js
// Deus Protocol v1 - test suite
const { Identity } = require("./identity");
const { WhisperMessage, WhisperChannel } = require("./whisper");
const { DeadDrop } = require("./dead-drop");
const { TaskQueue, TASK_TYPES } = require("./task-queue");
const { DeusAgent } = require("./agent");

let p = 0, f = 0;
function ch(name, ok) { if (ok) { p++; console.log("  PASS  " + name); } else { f++; console.log("  FAIL  " + name); } }

async function main() {
console.log("");
console.log("==== Deus Protocol v1 - Verification Suite ====");

console.log(""); console.log("--- [1] Identity (Ed25519) ---");
const id1 = new Identity().generate();
ch("Agent ID format", id1.id.startsWith("Deus-Agent-"));
ch("Fingerprint length", id1.fingerprint.length === 16);
const sig = id1.sign("test-message");
ch("Sign returns buffer", Buffer.isBuffer(sig));
ch("Self-verify", Identity.verify(id1.exportPublic(), "test-message", sig));
ch("Reject wrong data", !Identity.verify(id1.exportPublic(), "wrong", sig));
const id2 = Identity.fromPublicKey(id1.exportPublic());
ch("Reconstruct from pubkey", id2.fingerprint === id1.fingerprint);

console.log(""); console.log("--- [2] Whisper Messaging ---");
const a = new Identity().generate(), b = new Identity().generate();
const ca = new WhisperChannel(a), cb = new WhisperChannel(b);
ca.addPeer(b.id, b.exportPublic()); cb.addPeer(a.id, a.exportPublic());
const sent = ca.send(b.id, "HELO from A");
ch("Message sent", sent.status === "sent");
ch("Has signature", !!sent.signature);
const recv = cb.receive(sent);
ch("Message received", recv.status === "ok");
ch("Content matches", recv.data === "HELO from A");
const badPkt = { message: JSON.stringify({ from: "unknown", payload: "x" }), signature: "ff" };
ch("Reject unknown sender", cb.receive(badPkt).status === "unknown_sender");

console.log(""); console.log("--- [3] Task Queue ---");
const tq = new TaskQueue();
const t1 = tq.enqueue(TASK_TYPES.PERCEIVE, { target: "local" });
ch("Task ID format", t1.id.includes("-"));
ch("Status pending", t1.status === "pending");
ch("Queue has 1", tq.pending() === 1);
tq.complete(t1.id, { data: "ok" });
ch("Queue empty", tq.pending() === 0);
ch("History has 1", tq.stats().history === 1);
const t2 = tq.enqueue(TASK_TYPES.STORE, { fragment: "test" });
tq.fail(t2.id, "test_error");
ch("Failed tracked", tq.stats().history === 2);

console.log(""); console.log("--- [4] Dead Drop ---");
const dId = new Identity().generate(); const dd = new (require("./dead-drop")).DeadDrop(dId);
const box = dd.createDropBox();
ch("Box created", !!box.id);
const dep = dd.deposit(box.id, box.key, "secret_data", dId.exportPublic());
ch("Deposit ok", dep.status === "deposited");
const col = dd.collect(box.id, box.key, dId.exportPublic());
ch("Collect ok", col.status === "ok");
ch("Message found", col.count === 1);
const box2 = dd.rotate();
ch("Rotation", box2.id !== box.id);

console.log(""); console.log("--- [5] Deus-Agent Runtime ---");
const ag = new DeusAgent("TestAgent");
ch("Agent identity", ag.identity.fingerprint.length === 16);
ag.joinP2P("deus_test");
ch("P2P node", !!ag.p2pNode);
ag.queue.enqueue(TASK_TYPES.PERCEIVE, {});
ag.queue.enqueue(TASK_TYPES.STORE, { fragment: { _tag: "test" } });
ch("Queue has 2", ag.queue.pending() === 2);
const proc = ag.processQueue();
ch("Processed all", proc === 2);
ch("Queue empty", ag.queue.pending() === 0);
const st = ag.stats();
ch("Stats has id", !!st.id);
ch("Stats has p2p", !!st.p2p);
ch("Stats has queue", !!st.queue);
ag.shutdown();

const total = p + f;
console.log("");
console.log("==== " + total + " checks, " + p + " passed, " + f + " failed ====");
if (f > 0) process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });