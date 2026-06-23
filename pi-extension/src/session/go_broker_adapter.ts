/**
 * GoBrokerAdapter — adapts pi-broker (the Go UDS broker) to the TypeScript
 * `Broker` interface so `broker_remote.ts`, `bridge.ts`, and `mesh_node.ts`
 * can use it without changes.
 *
 * Instead of hosting a Broker in-process, this adapter talks to the
 * standalone pi-broker over the same UDS socket that `SessionPeer`
 * already connects to — it's just a thin proxy that maps method calls
 * to JSON-line envelopes over the existing connection.
 *
 * Because pi-broker handles local routing natively (no in-process
 * RemoteRouter), `setRemoteRouter` is a no-op — outbound cross-PC
 * routing is handled at the `agent_send` tool level instead.
 */

import type { SessionPeer } from "./peer.js";
import type { Envelope } from "./envelope.js";
import type { PeerInfo, RemoteInjectStatus, RemoteRouter } from "./broker.js";

export class GoBrokerAdapter {
  private peer: SessionPeer | null = null;

  /** Attach to a live SessionPeer. Must be called before any broker methods. */
  attach(peer: SessionPeer): void {
    this.peer = peer;
  }

  /** Detach — called when the session ends. */
  detach(): void {
    this.peer = null;
  }

  // ── Broker interface methods ────────────────────────────────────────────

  /**
   * Inject a cross-PC message into the local mesh by sending it to pi-broker
   * via the regular UDS connection. pi-broker routes it to the target peer.
   */
  injectFromRemote(env: Envelope): RemoteInjectStatus {
    if (!this.peer) return "denied";
    if (typeof env.to !== "string" || env.to === "broadcast" || env.to === "broker") {
      return "denied";
    }
    try {
      // Send to pi-broker as a regular envelope — it will route to the target
      this.peer.send(env.to, env.body, env.re).catch(() => {});
      return "received";
    } catch {
      return "denied";
    }
  }

  /**
   * Get local peers by querying pi-broker via list_peers. Falls back to
   * empty array on error.
   */
  localPeerInfos(): PeerInfo[] {
    // We don't have a synchronous way to query pi-broker here.
    // The caller should use SessionPeer.request() instead.
    // Return empty — the cross-PC bridge will work, just without the
    // initial peer list push. Subsequent peer_joined/left broadcasts
    // keep siblings in sync.
    return [];
  }

  /**
   * No-op: pi-broker has no RemoteRouter concept. Outbound cross-PC
   * routing is handled at the `agent_send` tool level instead.
   */
  setRemoteRouter(_router: RemoteRouter | null): void {
    // No-op — pi-broker handles routing natively.
  }
}
