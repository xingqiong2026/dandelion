# p2p_node.py
# Python P2P node — 与 JS p2p-discovery.js 协议兼容
# 蒲公英计划 v4 跨语言客户端
# 支持: UDP 多播发现 / TCP 中继注册 / 碎片传输

import socket
import json
import struct
import threading
import time
import random
import hashlib
import os
import sys

MULTICAST_ADDR = "239.255.10.10"
DISCOVERY_PORT = 53124
DATA_PORT_BASE = 44000
NODE_TTL = 5

MSG_TYPE = {
    "HELO": "HELO",
    "PING": "PING",
    "PONG": "PONG",
    "FRAG": "FRAG",
    "BYE": "BYE"
}

# ============================================
# 本地 P2P 节点 (UDP 多播 + TCP 通信)
# ============================================

class P2PNode:
    def __init__(self, node_id=None):
        self.node_id = node_id or f"dust_{hashlib.sha256(os.urandom(4)).hexdigest()[:8]}"
        self.peers = {}
        self.remote_peers = {}
        self.alive = False
        self.network = "dandelion"
        self.data_port = DATA_PORT_BASE + random.randint(0, 1000)
        self.relay_url = None
        self._station = None
        self._discovery_sock = None
        self._data_server = None

    def join(self, network="dandelion"):
        self.network = network
        self.alive = True

        self._discovery_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        self._discovery_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._discovery_sock.bind(('', DISCOVERY_PORT))
        try:
            mreq = struct.pack("4sl", socket.inet_aton(MULTICAST_ADDR), socket.INADDR_ANY)
            self._discovery_sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
        except Exception:
            pass

        self._data_server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._data_server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._data_server.bind(('0.0.0.0', self.data_port))
        self._data_server.listen(10)
        self._data_server.settimeout(1.0)

        threading.Thread(target=self._discovery_loop, daemon=True).start()
        threading.Thread(target=self._data_loop, daemon=True).start()

        def ping_loop():
            while self.alive:
                self._broadcast_discovery("HELO")
                now = time.time() * 1000
                for pm in [self.peers, self.remote_peers]:
                    expired = [pid for pid, info in pm.items() if now - info["lastSeen"] > NODE_TTL * 5000]
                    for pid in expired:
                        del pm[pid]
                time.sleep(3)

        threading.Thread(target=ping_loop, daemon=True).start()
        self._broadcast_discovery("HELO")
        return self

    def register_with_relay(self, relay_host, relay_port):
        self.relay_url = f"{relay_host}:{relay_port}"
        self._send_relay_register(relay_host, relay_port)

        def relay_loop():
            while self.alive:
                time.sleep(10)
                self._send_relay_register(relay_host, relay_port)

        threading.Thread(target=relay_loop, daemon=True).start()
        time.sleep(2)
        self._query_relay(relay_host, relay_port)

        def query_loop():
            while self.alive:
                time.sleep(8)
                self._query_relay(relay_host, relay_port)

        threading.Thread(target=query_loop, daemon=True).start()
        return self

    def _send_relay_register(self, host, port):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(3)
            s.connect((host, port))
            msg = json.dumps({"_relay": "register", "id": self.node_id, "dataPort": self.data_port, "network": self.network})
            s.sendall(msg.encode("utf-8"))
            s.close()
        except Exception:
            pass

    def _query_relay(self, host, port):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(3)
            s.connect((host, port))
            s.sendall(json.dumps({"_relay": "list", "network": self.network}).encode("utf-8"))
            s.shutdown(socket.SHUT_WR)
            data = b""
            while True:
                chunk = s.recv(4096)
                if not chunk:
                    break
                data += chunk
            s.close()
            if data:
                resp = json.loads(data.decode("utf-8"))
                if resp.get("_relay") == "node_list":
                    for n in resp.get("nodes", []):
                        nid = n["id"]
                        if nid != self.node_id and nid not in self.peers and nid not in self.remote_peers:
                            self.remote_peers[nid] = {
                                "host": n["host"], "dataPort": n["dataPort"],
                                "lastSeen": time.time() * 1000, "firstSeen": time.time() * 1000,
                                "viaRelay": True
                            }
                            if self._station:
                                self._station("remote_peer_found", {"id": nid, "host": n["host"]})
        except Exception:
            pass

    def _broadcast_discovery(self, msg_type, extra=None):
        msg = json.dumps({
            "type": msg_type, "id": self.node_id, "port": self.data_port,
            "network": self.network, "ts": int(time.time() * 1000), "extra": extra or {}
        })
        try:
            self._discovery_sock.sendto(msg.encode("utf-8"), (MULTICAST_ADDR, DISCOVERY_PORT))
        except Exception:
            pass

    def _discovery_loop(self):
        while self.alive:
            try:
                data, addr = self._discovery_sock.recvfrom(4096)
                self._handle_discovery_message(data, addr)
            except Exception:
                pass

    def _handle_discovery_message(self, data, addr):
        try:
            msg = json.loads(data.decode("utf-8"))
            if msg.get("network") != self.network or msg.get("id") == self.node_id:
                return
            mid = msg["id"]
            if msg.get("type") == "HELO":
                self.peers[mid] = {
                    "host": addr[0], "dataPort": msg.get("port", self.data_port),
                    "lastSeen": time.time() * 1000,
                    "firstSeen": self.peers.get(mid, {}).get("firstSeen", time.time() * 1000)
                }
                if self._station:
                    self._station("peer_found", {"id": mid, "host": addr[0], "port": msg.get("port"), "peers": len(self.peers)})
            elif msg.get("type") == "BYE":
                self.peers.pop(mid, None)
        except Exception:
            pass

    def _data_loop(self):
        while self.alive:
            try:
                conn, addr = self._data_server.accept()
                threading.Thread(target=self._handle_data_connection, args=(conn, addr), daemon=True).start()
            except socket.timeout:
                pass
            except Exception:
                pass

    def _handle_data_connection(self, conn, addr):
        try:
            conn.settimeout(5)
            data = b""
            while True:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                data += chunk
                try:
                    msg = json.loads(data.decode("utf-8"))
                    if self._station:
                        self._station("data_received", msg)
                    break
                except (json.JSONDecodeError, ValueError):
                    continue
        except Exception:
            pass
        finally:
            try:
                conn.close()
            except Exception:
                pass

    def send_fragment(self, peer_id, fragment):
        peer = self.peers.get(peer_id) or self.remote_peers.get(peer_id)
        if not peer:
            return {"status": "peer_not_found"}
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(3)
            s.connect((peer["host"], peer["dataPort"]))
            s.sendall(json.dumps({"type": "FRAG", "from": self.node_id, "fragment": fragment, "ts": int(time.time() * 1000)}).encode("utf-8"))
            s.close()
            return {"status": "sent", "peer": peer_id}
        except Exception:
            self.peers.pop(peer_id, None)
            self.remote_peers.pop(peer_id, None)
            return {"status": "error"}

    def broadcast_fragment(self, fragment):
        results = []
        for pid in list(self.peers.keys()):
            results.append(self.send_fragment(pid, fragment))
        for pid in list(self.remote_peers.keys()):
            results.append(self.send_fragment(pid, fragment))
        return results

    def stats(self):
        return {
            "nodeId": self.node_id, "alive": self.alive,
            "localPeers": len(self.peers), "remotePeers": len(self.remote_peers),
            "totalPeers": len(self.peers) + len(self.remote_peers),
            "peerList": list(self.peers.keys()) + list(self.remote_peers.keys()),
            "dataPort": self.data_port, "network": self.network
        }

    def on_message(self, callback):
        self._station = callback

    def leave(self):
        self.alive = False
        self._broadcast_discovery("BYE")
        try:
            self._discovery_sock.close()
        except Exception:
            pass
        try:
            self._data_server.close()
        except Exception:
            pass
        self.peers.clear()
        self.remote_peers.clear()


class RelayNode:
    def __init__(self, port=None):
        self.port = port or 53125
        self.registry = {}
        self.server = None
        self.alive = False
        self._lock = threading.Lock()

    def start(self):
        self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server.bind(('0.0.0.0', self.port))
        self.server.listen(50)
        self.server.settimeout(1.0)
        self.alive = True
        print(f"  [Relay] Listening on port {self.port}")

        def accept_loop():
            while self.alive:
                try:
                    conn, addr = self.server.accept()
                    threading.Thread(target=self._handle_client, args=(conn, addr), daemon=True).start()
                except socket.timeout:
                    pass
                except Exception:
                    pass

        threading.Thread(target=accept_loop, daemon=True).start()

        def cleanup_loop():
            while self.alive:
                time.sleep(15)
                now = time.time() * 1000
                with self._lock:
                    to_delete = []
                    for net, nodes in self.registry.items():
                        alive = [n for n in nodes if now - n["lastSeen"] < 30000]
                        if alive:
                            self.registry[net] = alive
                        else:
                            to_delete.append(net)
                    for net in to_delete:
                        del self.registry[net]

        threading.Thread(target=cleanup_loop, daemon=True).start()
        return self

    def _handle_client(self, conn, addr):
        try:
            conn.settimeout(5)
            data = b""
            while True:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                data += chunk
                try:
                    msg = json.loads(data.decode("utf-8"))
                    client_host = addr[0]
                    if msg.get("_relay") == "register":
                        self._register(msg["id"], client_host, msg.get("dataPort", 0), msg.get("network", "dandelion"))
                        conn.sendall(json.dumps({"_relay": "registered", "id": msg["id"]}).encode("utf-8"))
                    elif msg.get("_relay") == "list":
                        nodes = self._list(msg.get("network", "dandelion"), msg.get("id"))
                        conn.sendall(json.dumps({"_relay": "node_list", "nodes": nodes}).encode("utf-8"))
                    break
                except (json.JSONDecodeError, ValueError):
                    continue
        except Exception:
            pass
        finally:
            try:
                conn.close()
            except Exception:
                pass

    def _register(self, node_id, host, data_port, network):
        net = network or "dandelion"
        with self._lock:
            if net not in self.registry:
                self.registry[net] = []
            nodes = self.registry[net]
            for n in nodes:
                if n["id"] == node_id:
                    n["lastSeen"] = time.time() * 1000
                    n["host"] = host
                    return
            nodes.append({"id": node_id, "host": host, "dataPort": data_port, "lastSeen": time.time() * 1000, "firstSeen": time.time() * 1000})

    def _list(self, network, exclude_id=None):
        with self._lock:
            nodes = []
            for net_nodes in self.registry.values():
                nodes.extend(net_nodes)
            result = [n for n in nodes if n["id"] != exclude_id]
            return [{"id": n["id"], "host": n["host"], "dataPort": n["dataPort"]} for n in result]

    def stop(self):
        self.alive = False
        try:
            self.server.close()
        except Exception:
            pass
        with self._lock:
            self.registry.clear()


def test():
    passed = 0
    failed = 0

    def check(name, condition):
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"  PASS  {name}")
        else:
            failed += 1
            print(f"  FAIL  {name}")

    print()
    print("--- Test: P2PNode ---")
    node = P2PNode("test_node")
    check("Node ID set", node.node_id == "test_node")
    check("Data port in range", 44000 <= node.data_port <= 45000)
    check("Node not alive initially", not node.alive)

    node.join("test_net")
    check("Node alive after join", node.alive)
    check("Network set", node.network == "test_net")

    s = node.stats()
    check("Stats has nodeId", s["nodeId"] == "test_node")
    check("Stats shows alive", s["alive"])
    check("Stats has localPeers", "localPeers" in s)
    check("Stats has remotePeers", "remotePeers" in s)

    node.leave()
    check("Node not alive after leave", not node.alive)
    check("Peers cleared", len(node.peers) == 0)

    print()
    print("--- Test: RelayNode ---")
    relay = RelayNode(53126)
    relay.start()
    check("Relay alive after start", relay.alive)

    relay._register("node_a", "192.168.1.10", 44001, "test_net")
    relay._register("node_b", "192.168.1.11", 44002, "test_net")
    check("Registry has 2 nodes", len(relay.registry.get("test_net", [])) == 2)

    nodes = relay._list("test_net", "node_a")
    check("List excludes node_a", len(nodes) == 1)
    check("Listed node is node_b", nodes[0]["id"] == "node_b")

    relay.stop()
    check("Relay not alive after stop", not relay.alive)

    print()
    print(f"--- Results: {passed} passed, {failed} failed ---")
    return failed == 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        test()
    else:
        print("Python P2P Node. Usage: python p2p_node.py [--test | relay [port] | relay_client host port]")
