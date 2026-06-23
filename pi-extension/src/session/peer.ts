import type { Socket } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { type Envelope, envelope, parse, serialize, EnvelopeError } from "./envelope.js";

/**
 * Symmetric peer connected to the Go pi-broker. All peers are "followers" —
 * there is no leader election or in-process TypeScript Broker. Every agent
 * connects to the standalone pi-broker binary over UDS.
 *
 * Pending map demuxes parallel `request()` calls by message `id` → `re`.
 *
 * Reconnect: if the broker socket closes (broker restart), we retry the
 * connection with backoff.
 */
export type MessageHandler = (env: Envelope) => void;
export type ReconnectHandler = () => void;

export interface SessionPeerOptions {
  sockPath: string;
  name: string;
  cwd?: string;
  auditPath?: string;
  defaultTimeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const ACK_TIMEOUT_MS = 5_000;
const FAILOVER_RETRY_MS = 100;

export type AckStatus = "received" | "busy" | "denied" | "timeout";

export interface AckResult {
  status: AckStatus;
  id: string;
  target?: string;
}

interface AckBody {
  type: "ack";
  status: "received" | "busy" | "denied";
  target: string;
}

export class SessionPeer {
  private readonly opts: SessionPeerOptions;
  private assignedName: string;
  private assignedAddress: string;
  private socket: Socket | null = null;
  private buf = "";
  private readonly pending = new Map<string, {
    resolve: (env: Envelope) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private readonly ackPending = new Map<string, {
    resolve: (result: AckResult) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private readonly handlers = new Set<MessageHandler>();
  private readonly reconnectHandlers = new Set<ReconnectHandler>();
  private leftFlag = false;

  constructor(opts: SessionPeerOptions) {
    this.opts = opts;
    this.assignedName = opts.name;
    this.assignedAddress = opts.name;
  }

  // ── public API ────────────────────────────────────────────────────────────

  async start(): Promise<string> {
    return this._connect();
  }

  name(): string {
    return this.assignedName;
  }

  address(): string {
    return this.assignedAddress;
  }

  currentRole(): "leader" | "follower" {
    return "follower"; // Always follower (pi-broker is always the leader)
  }

  localBroker(): null {
    return null; // No TypeScript Broker — use pi-broker
  }

  async send(to: string | string[], body: unknown, re: string | null = null): Promise<void> {
    const env = envelope(this.assignedAddress, to, body, re);
    await this._writeEnvelope(env);
  }

  async sendWithAck(
    to: string,
    body: unknown,
    re: string | null = null,
    timeoutMs: number = ACK_TIMEOUT_MS,
  ): Promise<AckResult> {
    const env = envelope(this.assignedAddress, to, body, re);
    return new Promise<AckResult>((resolve) => {
      const timer = setTimeout(() => {
        this.ackPending.delete(env.id);
        resolve({ status: "timeout", id: env.id });
      }, timeoutMs);
      this.ackPending.set(env.id, { resolve, timer });
      this._writeEnvelope(env).catch(() => {
        const slot = this.ackPending.get(env.id);
        if (!slot) return;
        clearTimeout(slot.timer);
        this.ackPending.delete(env.id);
        resolve({ status: "timeout", id: env.id });
      });
    });
  }

  async request(
    to: string,
    body: unknown,
    timeoutMs: number = this.opts.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
  ): Promise<Envelope> {
    const env = envelope(this.assignedAddress, to, body, null);
    return new Promise<Envelope>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(env.id);
        reject(new Error(`request to ${to} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(env.id, { resolve, reject, timer });
      this._writeEnvelope(env).catch((err) => {
        const slot = this.pending.get(env.id);
        if (!slot) return;
        clearTimeout(slot.timer);
        this.pending.delete(env.id);
        reject(err);
      });
    });
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onReconnect(handler: ReconnectHandler): () => void {
    this.reconnectHandlers.add(handler);
    return () => this.reconnectHandlers.delete(handler);
  }

  async rename(newName: string): Promise<string> {
    await this._teardownConn();
    this.opts.name = newName;
    this.assignedName = newName;
    return this._connect();
  }

  async leave(): Promise<void> {
    this.leftFlag = true;
    await this._teardownConn();
  }

  // ── connect / reconnect ───────────────────────────────────────────────────

  private async _connect(): Promise<string> {
    const { createConnection } = await import("node:net");
    const sock = createConnection(this.opts.sockPath);
    await new Promise<void>((resolve, reject) => {
      sock.once("connect", () => resolve());
      sock.once("error", reject);
    });
    this._wireSocket(sock);
    return this._registerOver(sock);
  }

  private _wireSocket(sock: Socket): void {
    this.socket = sock;
    this.buf = "";
    sock.setEncoding("utf8");
    sock.on("data", (chunk: string) => this._onData(chunk));
    sock.on("close", () => this._onSocketClose(sock));
    sock.on("error", () => { /* close will follow */ });
  }

  private _registerOver(sock: Socket): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const wait = setTimeout(() => reject(new Error("register_ack timeout")), 5_000);
      const onceListener = (raw: unknown) => {
        clearTimeout(wait);
        const ack = raw as { type?: string; name_assigned?: string; address_assigned?: string };
        const name = typeof ack?.name_assigned === "string" ? ack.name_assigned : ack?.address_assigned;
        const address = typeof ack?.address_assigned === "string" ? ack.address_assigned : ack?.name_assigned;
        if (ack && ack.type === "register_ack" && typeof name === "string" && typeof address === "string") {
          this.assignedName = name;
          this.assignedAddress = address;
          this._preAckListener = null;
          resolve(name);
        } else {
          reject(new Error(`expected register_ack, got: ${JSON.stringify(raw)}`));
        }
      };
      this._preAckListener = onceListener;
      const req = JSON.stringify({
        type: "register",
        name: this.opts.name,
        ...(this.opts.cwd !== undefined ? { cwd: this.opts.cwd } : {}),
      }) + "\n";
      try {
        sock.write(req);
      } catch (e) {
        clearTimeout(wait);
        reject(e as Error);
      }
    });
  }

  private _preAckListener: ((raw: unknown) => void) | null = null;

  private _onData(chunk: string): void {
    this.buf += chunk;
    let nl: number;
    while ((nl = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, nl);
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      this._handleLine(line);
    }
  }

  private _handleLine(line: string): void {
    if (this._preAckListener) {
      try {
        const parsed = JSON.parse(line) as unknown;
        this._preAckListener(parsed);
      } catch { /* ignore */ }
      return;
    }

    let env: Envelope;
    try {
      env = parse(line);
    } catch (e) {
      if (e instanceof EnvelopeError) return;
      throw e;
    }

    // Intercept broker ACKs
    if (env.re && (env.from === "broker" || env.from.endsWith(":broker"))) {
      const ackBody = env.body as { type?: string; status?: string; target?: string } | null;
      if (ackBody && ackBody.type === "ack" && typeof ackBody.status === "string") {
        const slot = this.ackPending.get(env.re);
        if (slot) {
          clearTimeout(slot.timer);
          this.ackPending.delete(env.re);
          const status = ackBody.status as AckBody["status"];
          slot.resolve({ status, id: env.re, target: ackBody.target });
        }
        return;
      }
    }

    // Correlate replies for request()
    if (env.re) {
      const slot = this.pending.get(env.re);
      if (slot) {
        clearTimeout(slot.timer);
        this.pending.delete(env.re);
        slot.resolve(env);
        return;
      }
    }

    // Dispatch to subscribers
    for (const h of this.handlers) {
      try { h(env); } catch { /* handler errors don't break peer */ }
    }
  }

  private async _writeEnvelope(env: Envelope): Promise<void> {
    if (!this.socket || this.socket.destroyed) {
      throw new Error("session peer not connected");
    }
    this.socket.write(serialize(env));
  }

  private async _onSocketClose(closedSock: Socket): Promise<void> {
    if (this.leftFlag) return;
    if (this.socket !== closedSock) return;
    await delay(FAILOVER_RETRY_MS);
    if (this.leftFlag || this.socket !== closedSock) return;
    try {
      const name = await this._connect();
      for (const h of this.reconnectHandlers) {
        try { h(); } catch { /* handler errors don't break peer */ }
      }
    } catch { /* connection failed; peer stuck in disconnected state */ }
  }

  private async _teardownConn(): Promise<void> {
    if (this.socket) {
      try { this.socket.destroy(); } catch { /* ignored */ }
      this.socket = null;
    }
    for (const slot of this.pending.values()) {
      clearTimeout(slot.timer);
      slot.reject(new Error("peer leaving"));
    }
    this.pending.clear();
    for (const slot of this.ackPending.values()) {
      clearTimeout(slot.timer);
      slot.resolve({ status: "timeout", id: "" });
    }
    this.ackPending.clear();
  }
}
