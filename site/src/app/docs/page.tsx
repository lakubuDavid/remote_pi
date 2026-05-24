import type { Metadata } from "next";
import Link from "next/link";
import {
  DocsShell,
  DocsSection,
  DocsSubsection,
  InlineCode,
  DocsTable,
} from "@/components/docs-shell";
import { CodeBlock } from "@/components/code-block";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "How to install Remote Pi, pair a mobile device, run an agent network, and self-host the relay.",
};

const GITHUB_URL = "https://github.com/jacobaraujo7/remote_pi";
const PI_URL = "https://github.com/earendil-works/pi";
const RELAY_README_URL =
  "https://github.com/jacobaraujo7/remote_pi/blob/main/relay/README.md";
const ISSUES_URL = "https://github.com/jacobaraujo7/remote_pi/issues";

export default function DocsPage() {
  return (
    <DocsShell
      title="Remote Pi docs"
      lastUpdated="2026-05-24"
      sidebar={<DocsToc />}
      intro={
        <p>
          Remote Pi is a mesh for coding agents. Agents on the same machine
          talk through a local UDS broker; agents on different machines reach
          each other through an open-source relay; your phone authenticates
          new peers into the mesh and stays in sync across iOS and Android.
          The first supported harness is the{" "}
          <a className="text-accent underline" href={PI_URL} target="_blank" rel="noopener noreferrer">
            Pi coding agent
          </a>
          ; <InlineCode>/remote-pi</InlineCode> is the single slash command
          that wires everything up.
        </p>
      }
    >
      <DocsSection id="quick-start" title="Quick start">
        <p>Install the extension (one-time):</p>
        <CodeBlock code="pi install npm:remote-pi" label="On your Pi" language="bash" />
        <p>Then in any Pi terminal:</p>
        <CodeBlock code="/remote-pi" label="In Pi" language="text" />
        <p>
          The first run shows a short interactive wizard (agent name, whether
          to use the relay, whether to enable daemon mode). On every following
          run, <InlineCode>/remote-pi</InlineCode> joins the local mesh and
          starts the relay automatically — no extra typing.
        </p>

        <DocsSubsection id="agent-network-30s" title="Try the agent network in 30 seconds">
          <p>
            Open <strong className="text-fg">two</strong> Pi terminals in two{" "}
            <strong className="text-fg">different</strong> directories — one
            Pi process per cwd is enforced by a lock. Run{" "}
            <InlineCode>/remote-pi</InlineCode> in each and both join the same
            local mesh automatically (every machine has a single session
            named <InlineCode>local</InlineCode>). Now just talk to the LLM —
            it has the tools.
          </p>
          <p>
            In terminal A (say it ended up named <InlineCode>agent-A</InlineCode>):
          </p>
          <CodeBlock
            code="List the other agents available."
            label="agent-A · prompt"
            language="text"
          />
          <p>
            The LLM calls{" "}
            <InlineCode>list_peers()</InlineCode> and gets back something
            like{" "}
            <InlineCode>{`{ peers: ["agent-B"] }`}</InlineCode> (synchronous,
            ms-latency).
          </p>
          <p>Then, still in terminal A:</p>
          <CodeBlock
            code="Send a ping to agent-B."
            label="agent-A · prompt"
            language="text"
          />
          <p>
            The LLM calls{" "}
            <InlineCode>{`agent_send({ to: "agent-B", body: { type: "ping" } })`}</InlineCode>{" "}
            and immediately gets back{" "}
            <InlineCode>{`{ status: "received" }`}</InlineCode> (the ACK). The
            message lands in terminal B&apos;s inbox; its LLM sees the new
            envelope on its next turn and decides whether to reply by calling{" "}
            <InlineCode>{`agent_send({ to: "agent-A", re: "<id>", body: ... })`}</InlineCode>.
            Agent A then sees the reply on a future turn — fully event-driven,
            nothing blocks.
          </p>
          <p className="text-sm">
            (Replace <InlineCode>agent-B</InlineCode> with whatever name
            terminal B reports for itself — the wizard&apos;s default is the
            parent folder name with a <InlineCode>#N</InlineCode> suffix on
            collision.)
          </p>
        </DocsSubsection>
      </DocsSection>

      <DocsSection id="what-it-does" title="What it does">
        <p>
          Remote Pi sits on top of Pi (the first supported harness) and adds
          two independent layers. You can use either, or both.
        </p>

        <DocsSubsection id="agent-network-layer" title="1) Agent network (same machine and across PCs)">
          <p>
            Agents running side-by-side in different terminals discover each
            other and exchange messages. Each agent is a peer in the local
            mesh and gets three tools the LLM can call directly:
          </p>
          <ul className="ml-6 list-disc space-y-2">
            <li>
              <InlineCode>list_peers()</InlineCode> — synchronous, returns{" "}
              <InlineCode>{`{ peers: string[] }`}</InlineCode>. Locals plus
              cross-PC entries prefixed with the source PC&apos;s label (e.g.{" "}
              <InlineCode>MacMini:agent-1</InlineCode>).
            </li>
            <li>
              <InlineCode>agent_send({`{ to, body, re? }`})</InlineCode> —
              unicast with ACK. Returns{" "}
              <InlineCode>{`{ status: "received" | "busy" | "denied" | "timeout" | "sent" }`}</InlineCode>{" "}
              within ~5s. Set <InlineCode>re</InlineCode> when replying to an
              earlier message.
            </li>
            <li>
              <InlineCode>agent_request</InlineCode> —{" "}
              <strong className="text-fg">deprecated</strong>. Synchronous
              send-and-await wrapper kept for backward compatibility; emits a
              warning on first call. New agents use{" "}
              <InlineCode>agent_send</InlineCode> and observe the inbox in a
              future turn.
            </li>
          </ul>
          <p>
            On the same machine, peers talk through a Unix domain socket at{" "}
            <InlineCode>~/.pi/remote/sessions/local/broker.sock</InlineCode>{" "}
            — no network involved. Across machines, the same{" "}
            <InlineCode>agent_send</InlineCode> routes through the relay
            automatically: every PC paired to the same Owner key forms one
            logical mesh, and a remote peer is addressed verbatim by its
            prefixed name (e.g.{" "}
            <InlineCode>{`agent_send({ to: "MacMini:agent-1", ... })`}</InlineCode>).
            Useful for splitting work across roles
            (<InlineCode>backend</InlineCode>, <InlineCode>frontend</InlineCode>,{" "}
            <InlineCode>tests</InlineCode>, <InlineCode>orchestrator</InlineCode>, …)
            and letting them coordinate, whether they live on the same box or
            on machines that only meet on the relay.
          </p>
          <p>
            On any given machine, the first agent in the session becomes the{" "}
            <em>leader</em> (hosts the broker); the rest are{" "}
            <em>followers</em>. If the leader exits, a follower automatically
            takes over — the failover is invisible to the LLMs.
          </p>
        </DocsSubsection>

        <DocsSubsection id="mobile-app-layer" title="2) Mobile control plane (authenticator + remote)">
          <p>
            The mobile app is the authenticator and the remote control. You
            scan a QR once to bring a new machine into your mesh (or to add a
            new phone to your Owner key); from that point on the apps and PCs
            coordinate over the same{" "}
            <strong className="text-fg">relay</strong> — a small WebSocket
            server that ferries messages between paired peers. Multiple phones
            paired to the same Owner key stay in sync; multiple Owners can
            pair the same machine without colliding.
          </p>
          <p>
            <strong className="text-fg">Trust model (current MVP).</strong>{" "}
            Connections to the relay are TLS 1.3. Devices authenticate each
            other with Ed25519 challenge-response at pairing time, so paired
            peers can verify identity cryptographically.{" "}
            <strong className="text-fg">
              Application-layer end-to-end encryption of message payloads is
              not active in the current MVP
            </strong>{" "}
            — payloads travel base64-encoded over TLS, and the relay operator
            could in principle access plaintext in memory while forwarding. The
            public relay (operated by Flutterando) does not log, persist, or
            inspect payloads. If you need cryptographic confidentiality from
            the relay operator, run your own relay — see{" "}
            <a href="#relay" className="text-accent underline">
              The relay
            </a>{" "}
            below for a self-host guide. Restoring per-message E2E encryption
            is on the roadmap.{" "}
            <a
              className="text-accent underline"
              href={`${GITHUB_URL}/blob/main/PROTOCOL.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              PROTOCOL.md
            </a>{" "}
            is the source of truth for the wire format, identity model, ACK
            semantics, and failure modes — read it when this page disagrees
            with itself.
          </p>
          <p>App downloads:</p>
          <ul className="ml-6 list-disc space-y-2">
            <li>
              <strong className="text-fg">Google Play</strong> — <em>coming soon</em>
            </li>
            <li>
              <strong className="text-fg">App Store</strong> — <em>coming soon</em>
            </li>
            <li>
              <strong className="text-fg">Android APK</strong> — direct download from the{" "}
              <a className="text-accent underline" href={`${GITHUB_URL}/releases`} target="_blank" rel="noopener noreferrer">
                GitHub Releases page
              </a>
              .
            </li>
          </ul>
          <p>
            Until the public stores have the app, follow{" "}
            <a className="text-accent underline" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              the repo
            </a>{" "}
            for build/beta info.
          </p>
        </DocsSubsection>
      </DocsSection>

      <DocsSection id="install" title="Install">
        <p>
          Requirements: Node 20+ and Pi (the host coding agent).
        </p>
        <CodeBlock code="pi install npm:remote-pi" label="Install" language="bash" />
        <p>
          The extension self-registers the <InlineCode>/remote-pi</InlineCode>{" "}
          slash command and deploys an agent skill that teaches the LLM how to
          use <InlineCode>list_peers</InlineCode> /{" "}
          <InlineCode>agent_send</InlineCode>.
        </p>
        <p>To verify:</p>
        <CodeBlock code="/remote-pi config" label="In Pi" language="text" />
        <p>
          It should print the effective relay URL and where it came from
          (<InlineCode>env</InlineCode> / <InlineCode>config</InlineCode> /{" "}
          <InlineCode>default</InlineCode>).
        </p>
        <p>
          <strong className="text-fg">Planning to use daemon mode?</strong>{" "}
          Run <InlineCode>/remote-pi install</InlineCode> from inside Pi when
          you&apos;re ready — it installs the user-level supervisor service
          (launchd on macOS, <InlineCode>systemd --user</InlineCode> on Linux)
          and symlinks the <InlineCode>remote-pi</InlineCode> +{" "}
          <InlineCode>pi-supervisord</InlineCode> CLIs into{" "}
          <InlineCode>~/.local/bin/</InlineCode>. The setup wizard also
          offers to do this on first run. See{" "}
          <a href="#daemon-mode" className="text-accent underline">
            Daemon mode
          </a>{" "}
          for the full flow.
        </p>
      </DocsSection>

      <DocsSection id="using-remote-pi" title="Using /remote-pi">
        <p>The bare command is the everyday entry point:</p>
        <CodeBlock code="/remote-pi" label="In Pi" language="text" />
        <p>
          Behavior depends on whether there&apos;s a local config for this
          directory:
        </p>
        <DocsTable
          headers={["State", "What happens"]}
          rows={[
            [
              <>First run (no <InlineCode>.pi/remote-pi/config.json</InlineCode>)</>,
              "Interactive wizard → saves config → joins local mesh → starts relay (if you opted in)",
            ],
            [
              "Returning user, auto-start enabled",
              "Joins local mesh + starts relay automatically, then prints status",
            ],
            [
              "Returning user, auto-start disabled",
              "Prints status only; mesh/relay must be re-enabled via /remote-pi setup",
            ],
          ]}
        />
        <p>The wizard asks three questions:</p>
        <ol className="ml-6 list-decimal space-y-2">
          <li>
            <strong className="text-fg">Agent name</strong> — how other peers
            address you in <InlineCode>list_peers()</InlineCode> and{" "}
            <InlineCode>agent_send</InlineCode>. Defaults to the parent folder
            of the current cwd, with a <InlineCode>#N</InlineCode> suffix on
            collision.
          </li>
          <li>
            <strong className="text-fg">Use the relay on this terminal?</strong>{" "}
            — <InlineCode>Yes</InlineCode> connects this Pi to the remote
            mesh (mobile app + cross-PC peers via the relay).{" "}
            <InlineCode>No</InlineCode> keeps it local-only (agent network on
            the same machine, no mobile or cross-PC reach).
          </li>
          <li>
            <strong className="text-fg">Enable daemon mode?</strong> —{" "}
            <InlineCode>Yes</InlineCode> installs the supervisor service
            (launchd/systemd <InlineCode>--user</InlineCode>) and symlinks the{" "}
            <InlineCode>remote-pi</InlineCode> +{" "}
            <InlineCode>pi-supervisord</InlineCode> CLIs into{" "}
            <InlineCode>~/.local/bin/</InlineCode> so this folder can run as a
            24/7 background agent. <InlineCode>No</InlineCode> skips the
            service install; you can opt in later with{" "}
            <InlineCode>/remote-pi install</InlineCode>.
          </li>
        </ol>
        <p>
          Re-run the wizard later with <InlineCode>/remote-pi setup</InlineCode>.
        </p>
      </DocsSection>

      <DocsSection id="pairing" title="Pairing a mobile device">
        <p>You can call <InlineCode>/remote-pi pair</InlineCode> directly:</p>
        <CodeBlock code="/remote-pi pair" label="In Pi" language="text" />
        <p>
          If mesh and relay aren&apos;t running but a config exists,{" "}
          <InlineCode>pair</InlineCode> auto-bootstraps them before printing
          the QR. If no config exists yet (first time on this folder), the
          command tells you to run <InlineCode>/remote-pi</InlineCode> first
          to go through the wizard. The QR is only printed once the relay is
          actually connected.
        </p>
        <p>
          Scan the QR with the Remote Pi mobile app. Pairing is{" "}
          <strong className="text-fg">per machine</strong> — once a device is
          paired, every Pi process on this machine accepts it (it lives in{" "}
          <InlineCode>~/.pi/remote/peers.json</InlineCode>).
        </p>
        <p>To list paired devices:</p>
        <CodeBlock code="/remote-pi devices" label="In Pi" language="text" />
        <p>To remove one:</p>
        <CodeBlock code="/remote-pi revoke <shortid>" label="In Pi" language="text" />
        <p>
          The shortid is the first 8 chars shown by{" "}
          <InlineCode>devices</InlineCode>.
        </p>
      </DocsSection>

      <DocsSection id="relay" title="The relay">
        <p>
          The relay is the only network-touching piece of Remote Pi. In the
          current MVP it sees both message payloads (forwarded but never
          logged or inspected by the community operator) and connection
          metadata: which keypair is online, which room/cwd identifiers
          exist, message timing, sizes. Application-layer end-to-end
          encryption of payloads is on the roadmap — see the{" "}
          <a href="#mobile-app-layer" className="text-accent underline">
            trust model
          </a>{" "}
          above and the Privacy Policy, section 9, for the full picture.
        </p>
        <p>
          The relay also <strong className="text-fg">persists a small SQLite
          table</strong> called <InlineCode>mesh_versions</InlineCode> — blobs
          signed by your Owner key listing the Pi devices that belong to your
          mesh (a few KB per Owner). The relay verifies the Ed25519
          signature on every <InlineCode>POST /mesh/&lt;owner_pk_hash&gt;</InlineCode>{" "}
          and stores what you signed; it never decides membership itself.
          New devices restoring your Owner key recover their peer list from
          this blob. A relay compromise means DoS, not impersonation. See the{" "}
          <a
            className="text-accent underline"
            href={`${GITHUB_URL}/blob/main/PROTOCOL.md`}
            target="_blank"
            rel="noopener noreferrer"
          >
            PROTOCOL.md
          </a>{" "}
          mesh-membership section for the wire format.
        </p>
        <p>You have two options.</p>

        <DocsSubsection id="community-relay" title="Option A — Use the community relay">
          <p>
            <InlineCode>https://relay-rp1.jacobmoura.work</InlineCode> (default).
            Zero setup. Good for trying things out or for casual use.
            (Internally the extension uses the WebSocket form{" "}
            <InlineCode>wss://…</InlineCode> — both schemes point at the same
            endpoint.)
          </p>
          <p>Caveats:</p>
          <ul className="ml-6 list-disc space-y-2">
            <li>Shared infrastructure — availability is best-effort.</li>
            <li>
              <strong className="text-fg">TLS in transit is the only network protection</strong>
              {" "}— the relay operator sees plaintext envelopes (payloads,
              routing metadata, peer pubkeys, timing). Self-host for
              confidentiality from the operator.
            </li>
            <li>
              <strong className="text-fg">No IP allow-listing or VPN gating</strong>{" "}
              built in. Anyone with a paired keypair can connect; layer a
              VPN on top via Option B if you want network-level isolation.
            </li>
          </ul>
        </DocsSubsection>

        <DocsSubsection id="self-host" title="Option B — Self-host (recommended for privacy)">
          <p>
            Run the relay yourself in Docker and put it behind a VPN like{" "}
            <a className="text-accent underline" href="https://tailscale.com" target="_blank" rel="noopener noreferrer">Tailscale</a>,{" "}
            <a className="text-accent underline" href="https://www.wireguard.com" target="_blank" rel="noopener noreferrer">WireGuard</a>,
            or your own VPC. Because the relay&apos;s network-level protection
            is just TLS + keypair authentication, layering a VPN on top means{" "}
            <strong className="text-fg">only your devices</strong> can even
            reach the WebSocket port — defense in depth.
          </p>
          <p>
            Quick Docker outline (see the{" "}
            <a className="text-accent underline" href={`${RELAY_README_URL}#self-hosted-relay-recommended-for-privacy`} target="_blank" rel="noopener noreferrer">
              relay README
            </a>{" "}
            for the full setup, environment variables, and reverse-proxy
            guidance):
          </p>
          <CodeBlock
            code={`docker run -d \\
  --name remote-pi-relay \\
  -p 3000:3000 \\
  -v remote-pi-data:/data \\
  --restart unless-stopped \\
  jacobmoura7/remote-pi-relay`}
            label="On your relay host"
            language="bash"
          />
          <p>
            The <InlineCode>-v remote-pi-data:/data</InlineCode> mount is
            required — that&apos;s where the relay keeps{" "}
            <InlineCode>mesh.db</InlineCode> (the Owner-signed mesh blobs).
            Skip the volume and the table is wiped on every container restart,
            forcing every client to re-publish.
          </p>
          <p>
            The relay serves the WebSocket upgrade,{" "}
            <InlineCode>/health</InlineCode>, and{" "}
            <InlineCode>/mesh/&lt;owner_pk_hash&gt;</InlineCode> on the same
            port (default 3000) — point your reverse proxy at one upstream
            and you&apos;re done. Use <InlineCode>/health</InlineCode> for
            liveness probes (Coolify, Kubernetes, Fly health checks).
          </p>
          <p>
            Bind the container to your VPN interface, terminate TLS in a reverse
            proxy, and point both your Pi and your phone at the resulting{" "}
            <InlineCode>https://…</InlineCode> URL.
          </p>
        </DocsSubsection>

        <DocsSubsection id="point-pi" title="Pointing Pi at your own relay">
          <p>Once your relay is reachable, tell the extension:</p>
          <CodeBlock
            code="/remote-pi set-relay https://relay.yourdomain.tld"
            label="In Pi"
            language="text"
          />
          <p>
            The URL must be <InlineCode>http://</InlineCode> or{" "}
            <InlineCode>https://</InlineCode> —{" "}
            <InlineCode>wss://</InlineCode> / <InlineCode>ws://</InlineCode>{" "}
            are rejected at validation. The extension converts to the
            WebSocket form internally when it opens the connection, so you
            can paste whatever URL your reverse proxy or PaaS dashboard
            exposes.
          </p>
          <p>
            This writes <InlineCode>~/.pi/remote/config.json</InlineCode> with{" "}
            <InlineCode>{`{ "relay": "..." }`}</InlineCode>. Resolution order
            (highest precedence first):
          </p>
          <ol className="ml-6 list-decimal space-y-2">
            <li>
              <InlineCode>REMOTE_PI_RELAY</InlineCode> environment variable
              (CI / one-off overrides)
            </li>
            <li><InlineCode>~/.pi/remote/config.json</InlineCode></li>
            <li>
              The built-in default (
              <InlineCode>https://relay-rp1.jacobmoura.work</InlineCode>)
            </li>
          </ol>
          <p>Verify the active URL and its source with:</p>
          <CodeBlock code="/remote-pi config" label="In Pi" language="text" />
          <p>
            To switch URLs while connected: <InlineCode>/remote-pi stop</InlineCode>{" "}
            then <InlineCode>/remote-pi</InlineCode> again. The mobile app has
            its own relay-URL setting in its preferences pane — keep both
            pointing at the same relay.
          </p>
        </DocsSubsection>
      </DocsSection>

      <DocsSection id="agent-network" title="Agent network: deeper look">
        <p>
          Each session is one Unix-domain-socket broker plus N peers. The
          broker multiplexes messages by <InlineCode>to</InlineCode> name and
          broadcasts system events (<InlineCode>peer_joined</InlineCode>,{" "}
          <InlineCode>peer_left</InlineCode>).
        </p>
        <p>Inside the LLM, the agent skill registers three tools:</p>
        <CodeBlock
          label="Tools available to the LLM"
          language="jsonc"
          code={`// Discover peers (synchronous, ms-latency)
list_peers()
→ { peers: ["backend", "MacMini:agent-1", "trab:worker"] }

// Send a message with ACK (5s ack timeout)
agent_send({
  to: "backend",
  body: { task: "add /healthz endpoint" },
  re: "<id>"            // optional — set when REPLYING to an earlier message
})
→ { status: "received" | "busy" | "denied" | "timeout" | "sent" }

// Cross-PC sends use the same tool — just prefix with the pc_label
agent_send({ to: "MacMini:agent-1", body: { ... } })

// agent_request is DEPRECATED — emits a warning on first call.
// Kept for backward compat; new agents use agent_send and observe
// the inbox in a future turn.`}
        />
        <p>
          Replies arrive in a future turn as a normal envelope with{" "}
          <InlineCode>re=&lt;your-send-id&gt;</InlineCode>. The agent skill
          documents the retry matrix (
          <InlineCode>busy</InlineCode> → back off 2s/5s;{" "}
          <InlineCode>denied</InlineCode> → abandon;{" "}
          <InlineCode>timeout</InlineCode> → retry once;{" "}
          <InlineCode>sent</InlineCode> → cross-PC envelope was forwarded but
          the remote ACK hasn&apos;t arrived yet).
        </p>
        <p>
          The wire format is a 5-field envelope{" "}
          <InlineCode>{`{ from, to, id, re, body }`}</InlineCode> serialized as
          one JSON line per message. The leader&apos;s broker writes an{" "}
          <InlineCode>audit.jsonl</InlineCode> log at{" "}
          <InlineCode>~/.pi/remote/sessions/local/audit.jsonl</InlineCode>{" "}
          for postmortem inspection. See the{" "}
          <a href="#commands-local" className="text-accent underline">
            Command reference
          </a>{" "}
          for inspecting the mesh from the CLI side
          (<InlineCode>/remote-pi peers</InlineCode>).
        </p>
        <p>
          Name collisions inside a session get a numeric suffix automatically
          (<InlineCode>backend</InlineCode>, <InlineCode>backend#2</InlineCode>,{" "}
          <InlineCode>backend#3</InlineCode>). The broker assigns it and
          returns the real name to the peer.
        </p>
      </DocsSection>

      <DocsSection id="protocol" title="Protocol & Security">
        <p>
          The canonical spec for everything wire-level — envelope format,
          identity model (Owner key + per-device subkeys), ACK protocol,
          cross-PC routing, mesh membership, trust model, and failure modes
          — lives in{" "}
          <a
            className="text-accent underline"
            href={`${GITHUB_URL}/blob/main/PROTOCOL.md`}
            target="_blank"
            rel="noopener noreferrer"
          >
            PROTOCOL.md
          </a>{" "}
          on GitHub. It is the source of truth that the Pi extension, the
          mobile apps, and the relay all implement against. Read it when you
          need exact behavior or when writing a new harness adapter.
        </p>
        <p>
          A short summary of the security posture is on this page (
          <a href="#mobile-app-layer" className="text-accent underline">
            trust model
          </a>{" "}
          and{" "}
          <a href="#relay" className="text-accent underline">
            The relay
          </a>
          ); the Privacy Policy, section 9, restates it in plain language.
          PROTOCOL.md is the deep dive that matches the code.
        </p>
      </DocsSection>

      <DocsSection id="daemon-mode" title="Daemon mode">
        <p>
          When you want a Pi to keep running in the background — responding to
          mobile prompts at 3am, processing cron jobs, monitoring a folder
          while you&apos;re not at the keyboard — promote it to a{" "}
          <strong className="text-fg">daemon</strong> managed by a single
          OS-level supervisor. systemd on Linux, launchd on macOS; one
          supervisor process per machine, N background Pis underneath.
        </p>

        <DocsSubsection id="daemon-prereq" title="One-time setup">
          <p>
            The setup wizard&apos;s third question (
            <em>Enable daemon mode?</em>) does this for you on first run. If
            you answered <InlineCode>No</InlineCode> or want to opt in later,
            run from inside Pi:
          </p>
          <CodeBlock
            code="/remote-pi install"
            label="In Pi"
            language="text"
          />
          <p>That single command does two things:</p>
          <ul className="ml-6 list-disc space-y-2">
            <li>
              Installs the user-level supervisor service —{" "}
              <InlineCode>~/.config/systemd/user/remote-pi-supervisord.service</InlineCode>{" "}
              (Linux) or{" "}
              <InlineCode>~/Library/LaunchAgents/dev.remotepi.supervisord.plist</InlineCode>{" "}
              (macOS) — and activates it via{" "}
              <InlineCode>systemctl --user enable --now</InlineCode> /{" "}
              <InlineCode>launchctl bootstrap</InlineCode>. It auto-starts at
              login and survives reboots.
            </li>
            <li>
              Symlinks <InlineCode>remote-pi</InlineCode> and{" "}
              <InlineCode>pi-supervisord</InlineCode> into{" "}
              <InlineCode>~/.local/bin/</InlineCode> so the CLI is available
              from any shell. If <InlineCode>~/.local/bin</InlineCode> is not
              on your <InlineCode>$PATH</InlineCode>,{" "}
              <InlineCode>install</InlineCode> prints the exact snippet to
              add to <InlineCode>~/.zshrc</InlineCode> or{" "}
              <InlineCode>~/.bashrc</InlineCode>.
            </li>
          </ul>
        </DocsSubsection>

        <DocsSubsection id="daemon-per-folder" title="Per-folder workflow">
          <p>For each agent you want to keep alive 24/7:</p>
          <CodeBlock
            code={`# 1. Configure the agent interactively first (one time).
cd ~/Movies
pi                                 # /remote-pi → setup wizard, /remote-pi pair, etc

# 2. Promote to a daemon. The id is derived from the cwd
#    (sha256(realpath)[:8]), stable across machines.
remote-pi create ~/Movies --name "Video Editor"
# → Daemon registered: id=4e39152d name="Video Editor" cwd=/Users/x/Movies

# 3. Start it (supervisor spawns 'pi --mode rpc' for this folder).
remote-pi daemon start`}
            label="Per-folder flow"
            language="bash"
          />
          <p>
            The agent receives prompts as if a user typed them; its response
            flows back through the relay/mesh you configured during interactive
            setup — the mobile app sees it live, other agents on the same
            machine see it via the local UDS mesh.
          </p>
        </DocsSubsection>

        <DocsSubsection id="daemon-fleet" title="Fleet operations">
          <p>Once daemons are registered:</p>
          <CodeBlock
            code={`remote-pi daemons                  # list daemons + state
remote-pi daemon status            # uptime, pid, restart count
remote-pi daemon send 4e39152d "Cut the first 30 seconds of latest clip"
remote-pi daemon stop              # stop all
remote-pi daemon restart           # restart all`}
            label="Fleet commands"
            language="bash"
          />
          <p>
            All commands also work as Pi slash commands (interactive){" "}
            <strong className="text-fg">and</strong> as shell-level{" "}
            <InlineCode>remote-pi &lt;subcommand&gt;</InlineCode> when installed
            globally.
          </p>
        </DocsSubsection>

        <DocsSubsection id="daemon-remove" title="Removing or uninstalling">
          <CodeBlock
            code={`remote-pi remove <id>              # unregister one daemon (config preserved)
remote-pi uninstall                # remove the supervisor service (registry kept)`}
            label="Cleanup"
            language="bash"
          />
          <p>
            <InlineCode>uninstall</InlineCode> is reversible — re-running{" "}
            <InlineCode>install</InlineCode> later brings every registered
            daemon back. To wipe the registry entirely:
          </p>
          <CodeBlock
            code="rm ~/.pi/remote/daemons.json"
            label="Nuke the registry"
            language="bash"
          />
        </DocsSubsection>

        <DocsSubsection id="daemon-logs" title="Where to find logs">
          <DocsTable
            headers={["Platform", "Command"]}
            rows={[
              [
                "Linux",
                <InlineCode key="l">
                  journalctl --user -u remote-pi-supervisord -f
                </InlineCode>,
              ],
              [
                "macOS",
                <InlineCode key="m">
                  tail -f ~/.pi/remote/supervisord.log
                </InlineCode>,
              ],
            ]}
          />
          <p>
            Each spawned daemon&apos;s stderr is forwarded into the
            supervisor&apos;s log with a <InlineCode>[&lt;cwd&gt;]</InlineCode>{" "}
            prefix, so a single stream shows every agent.
          </p>
        </DocsSubsection>

        <DocsSubsection id="daemon-caveats" title="Caveats">
          <ul className="ml-6 list-disc space-y-2">
            <li>
              <strong className="text-fg">Tool approval is not gated.</strong>{" "}
              Daemons inherit the same Pi config the interactive run uses —
              Bash, Edit, Write, etc. all execute without prompting. Configure
              Pi&apos;s tool permissions to taste{" "}
              <em>before</em> promoting a folder to daemon. A tool-approval
              gate ships in a follow-up plan.
            </li>
            <li>
              <strong className="text-fg">Pairing is still interactive.</strong>{" "}
              Daemons don&apos;t show a QR themselves; the keypair and paired
              devices come from the prior interactive <InlineCode>pi</InlineCode>{" "}
              session in the same folder.
            </li>
            <li>
              <strong className="text-fg">Single supervisor.</strong> If{" "}
              <InlineCode>pi-supervisord</InlineCode> crashes, every daemon
              goes down with it. systemd/launchd restarts it within seconds and
              the children come back automatically.
            </li>
            <li>
              <strong className="text-fg">One daemon per cwd.</strong> The
              by-path id derivation rejects a second daemon in the same folder
              at <InlineCode>create</InlineCode> time.
            </li>
          </ul>
        </DocsSubsection>
      </DocsSection>

      <DocsSection id="commands" title="Command reference">
        <p>
          Every command works as a Pi slash command (interactive) and as a
          shell-level <InlineCode>remote-pi &lt;subcommand&gt;</InlineCode>{" "}
          when the package is installed globally (
          <InlineCode>npm install -g remote-pi</InlineCode>).
        </p>

        <DocsSubsection
          id="commands-local"
          title="Local session — one Pi, one terminal"
        >
          <DocsTable
            headers={["Command", "Description"]}
            rows={[
              [
                <InlineCode key="c">/remote-pi</InlineCode>,
                "Connect (join local mesh + start relay), or run setup on first use",
              ],
              [
                <InlineCode key="c">/remote-pi setup</InlineCode>,
                "Run the setup wizard and update local config",
              ],
              [
                <InlineCode key="c">/remote-pi status</InlineCode>,
                "Show local mesh + relay status",
              ],
              [
                <InlineCode key="c">/remote-pi peers</InlineCode>,
                "List local and cross-PC mesh peers, grouped by PC label",
              ],
              [
                <InlineCode key="c">/remote-pi stop</InlineCode>,
                <>Stop everything for <em>this</em> terminal (mesh + relay)</>,
              ],
              [
                <InlineCode key="c">/remote-pi pair</InlineCode>,
                "Show QR + copy-paste pairing URI for a new mobile device",
              ],
              [
                <InlineCode key="c">/remote-pi devices</InlineCode>,
                "List paired mobile devices (online/offline per device)",
              ],
              [
                <InlineCode key="c">/remote-pi revoke &lt;shortid&gt;</InlineCode>,
                "Revoke a paired device by its shortid",
              ],
              [
                <InlineCode key="c">/remote-pi set-relay &lt;url&gt;</InlineCode>,
                "Persist a new relay URL (http:// or https://)",
              ],
            ]}
          />
        </DocsSubsection>

        <DocsSubsection
          id="commands-daemon"
          title="Daemon fleet — one supervisor, N background Pis"
        >
          <p className="text-sm">
            See <a href="#daemon-mode" className="text-accent underline">Daemon mode</a> for the full flow.
          </p>
          <DocsTable
            headers={["Command", "Description"]}
            rows={[
              [
                <InlineCode key="c">/remote-pi create &lt;cwd&gt; [--name X]</InlineCode>,
                "Register a folder as a daemon",
              ],
              [
                <InlineCode key="c">/remote-pi remove &lt;id&gt;</InlineCode>,
                "Unregister a daemon (local config preserved)",
              ],
              [
                <InlineCode key="c">/remote-pi daemons</InlineCode>,
                "List registered daemons + state",
              ],
              [
                <InlineCode key="c">/remote-pi daemon start</InlineCode>,
                "Start every registered daemon",
              ],
              [
                <InlineCode key="c">/remote-pi daemon stop</InlineCode>,
                <>
                  Stop every running daemon (<InlineCode>/remote-pi stop</InlineCode>{" "}
                  stops only the local terminal)
                </>,
              ],
              [
                <InlineCode key="c">/remote-pi daemon restart</InlineCode>,
                "Stop + start all daemons",
              ],
              [
                <InlineCode key="c">/remote-pi daemon status</InlineCode>,
                "Detailed runtime status (pid, uptime, restart count)",
              ],
              [
                <InlineCode key="c">/remote-pi daemon send &lt;id&gt; &quot;&lt;text&gt;&quot;</InlineCode>,
                "Send a prompt to a specific daemon",
              ],
              [
                <InlineCode key="c">/remote-pi install</InlineCode>,
                <>
                  Install <InlineCode>pi-supervisord</InlineCode> as a system
                  service <strong className="text-fg">and</strong> symlink the{" "}
                  <InlineCode>remote-pi</InlineCode> CLI into{" "}
                  <InlineCode>~/.local/bin/</InlineCode>
                </>,
              ],
              [
                <InlineCode key="c">/remote-pi uninstall</InlineCode>,
                <>
                  Remove the system service <strong className="text-fg">and</strong>{" "}
                  the <InlineCode>~/.local/bin</InlineCode> symlinks (daemon
                  registry preserved)
                </>,
              ],
            ]}
          />
        </DocsSubsection>
        <p>The footer in the Pi TUI reflects state live:</p>
        <ul className="ml-6 list-disc space-y-2">
          <li>
            <InlineCode>📡 local (N)</InlineCode> — local mesh session and
            peer count
          </li>
          <li>
            <InlineCode>🟢 relay</InlineCode> — relay connected, at least one
            device paired on this machine
          </li>
          <li>
            <InlineCode>🟡 relay waiting for pairing</InlineCode> — relay
            connected, no device paired yet
          </li>
          <li>
            <InlineCode>📱 &lt;shortid&gt;</InlineCode> — a mobile device is
            actively connected right now
          </li>
        </ul>
        <p>
          The window title is two parts —{" "}
          <InlineCode>&lt;agent-name&gt; · On</InlineCode> when the relay is
          up or <InlineCode>&lt;agent-name&gt; · Off</InlineCode> otherwise —
          so you can tell your terminal tabs apart at a glance.
        </p>
      </DocsSection>

      <DocsSection id="config" title="Configuration files">
        <DocsTable
          headers={["Path", "Scope", "What's in it"]}
          rows={[
            [
              <InlineCode key="p">&lt;cwd&gt;/.pi/remote-pi/config.json</InlineCode>,
              "Per-directory",
              <>
                <InlineCode>agent_name</InlineCode>,{" "}
                <InlineCode>auto_start_relay</InlineCode>
              </>,
            ],
            [
              <InlineCode key="p">~/.pi/remote/config.json</InlineCode>,
              "Per-user",
              <><InlineCode>relay</InlineCode> URL</>,
            ],
            [
              <InlineCode key="p">~/.pi/remote/peers.json</InlineCode>,
              "Per-machine",
              "Paired mobile devices",
            ],
            [
              <InlineCode key="p">~/.pi/remote/daemons.json</InlineCode>,
              "Per-machine",
              <>Daemon registry (list of <InlineCode>{`{ cwd }`}</InlineCode> entries)</>,
            ],
            [
              <InlineCode key="p">~/.pi/remote/identity.json</InlineCode>,
              "Per-machine",
              <>
                Pi-secret fallback when the OS keyring is unavailable
                (headless Linux). Stored with{" "}
                <InlineCode>chmod 0600</InlineCode>. See{" "}
                <a
                  className="text-accent underline"
                  href={`${GITHUB_URL}/blob/main/PROTOCOL.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PROTOCOL.md
                </a>{" "}
                for the keyring details.
              </>,
            ],
            [
              <InlineCode key="p">~/.pi/remote/sessions/local/</InlineCode>,
              "Per-machine",
              <>Broker socket + <InlineCode>audit.jsonl</InlineCode></>,
            ],
            [
              <InlineCode key="p">~/.pi/remote/skills/agent-network/SKILL.md</InlineCode>,
              "Per-user",
              "Agent skill the LLM reads",
            ],
          ]}
        />
        <p>Override the relay for a single run without persisting:</p>
        <CodeBlock
          code="REMOTE_PI_RELAY=https://staging.example.tld pi"
          label="Shell"
          language="bash"
        />
        <p className="text-sm">
          Only <InlineCode>http://</InlineCode> /{" "}
          <InlineCode>https://</InlineCode> are accepted —{" "}
          <InlineCode>wss://</InlineCode> / <InlineCode>ws://</InlineCode> are
          rejected at validation, the extension converts to the WebSocket
          form internally when it opens the connection.
        </p>
      </DocsSection>

      <DocsSection id="troubleshooting" title="Troubleshooting">
        <DocsSubsection id="footer-stuck" title="Footer says 🟡 relay waiting for pairing even though I paired a device">
          <p>
            The icon reflects whether <em>any</em> device has been paired on
            this machine, not whether one is connected right now. If you really
            have a paired device in <InlineCode>/remote-pi devices</InlineCode>,
            restart Pi — the cache may be stale (fixed in current release;
            report a bug if it recurs).
          </p>
        </DocsSubsection>
        <DocsSubsection id="timeout-mobile" title="Mobile app times out connecting">
          <p>
            Verify the same relay URL is configured on both sides. If you
            self-host behind a VPN, your phone must also be on the VPN
            (Tailscale on iOS/Android works fine).
          </p>
        </DocsSubsection>
        <DocsSubsection id="timeout-request" title="Reply never arrives">
          <p>
            <InlineCode>agent_send</InlineCode> returned{" "}
            <InlineCode>{`{ status: "received" }`}</InlineCode> but no reply
            ever lands in your inbox. Possible causes:
          </p>
          <ul className="ml-6 list-disc space-y-2">
            <li>
              <strong className="text-fg">Receiver crashed or never processed.</strong>{" "}
              Run <InlineCode>/remote-pi peers</InlineCode> to see whether the
              peer is still online.
            </li>
            <li>
              <strong className="text-fg">The receiver chose not to reply.</strong>{" "}
              <InlineCode>agent_send</InlineCode> is not RPC — there&apos;s no
              obligation to respond. If the conversation needs a reply, the
              prompt to the receiver must say so explicitly.
            </li>
            <li>
              <strong className="text-fg">Cross-PC: peer went offline.</strong>{" "}
              Look in your inbox for a <InlineCode>transport_error</InlineCode>{" "}
              envelope with <InlineCode>re=&lt;your-send-id&gt;</InlineCode>{" "}
              — the relay returns one when a forwarded message can&apos;t be
              delivered.
            </li>
          </ul>
          <p className="text-sm">
            <strong className="text-fg">Note:</strong>{" "}
            <InlineCode>agent_request</InlineCode> is deprecated (still
            available as a wrapper for backward compat, emits a warning).
            New agents call <InlineCode>agent_send</InlineCode> and observe
            the inbox in a future turn.
          </p>
        </DocsSubsection>
        <DocsSubsection
          id="one-pi-per-cwd"
          title="Two Pi processes can't share a directory"
        >
          <p>
            A cwd lock allows{" "}
            <strong className="text-fg">one Pi process per directory</strong>.
            If you try to run <InlineCode>/remote-pi</InlineCode> in a second
            terminal that&apos;s already in the same folder, the second start
            is rejected (and the relay, separately, refuses a duplicate room
            with <InlineCode>RoomAlreadyOpenError</InlineCode>).
          </p>
          <p>
            <strong className="text-fg">To run two agents side by side:</strong>{" "}
            put them in two different directories and answer the setup wizard
            with the same <em>Default session</em> in each. Both processes
            then meet in the same agent-network room while keeping isolated
            workspaces.
          </p>
          <p>
            If you actually wanted a second terminal at the same workspace
            (e.g. just to read state), stop the running Pi first or open a
            shell that does <em>not</em> launch Pi.
          </p>
        </DocsSubsection>
      </DocsSection>

      <DocsSection id="links" title="Links">
        <ul className="ml-6 list-disc space-y-2">
          <li>
            Homepage:{" "}
            <Link href="/" className="text-accent underline">
              remote-pi.jacobmoura.work
            </Link>
          </li>
          <li>
            Source:{" "}
            <a className="text-accent underline" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              github.com/jacobaraujo7/remote_pi
            </a>
          </li>
          <li>
            Protocol spec:{" "}
            <a
              className="text-accent underline"
              href={`${GITHUB_URL}/blob/main/PROTOCOL.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              PROTOCOL.md
            </a>
          </li>
          <li>
            Pi coding agent:{" "}
            <a className="text-accent underline" href={PI_URL} target="_blank" rel="noopener noreferrer">
              github.com/earendil-works/pi
            </a>
          </li>
          <li>
            Relay (self-hosting guide):{" "}
            <a className="text-accent underline" href={RELAY_README_URL} target="_blank" rel="noopener noreferrer">
              relay/README.md
            </a>
          </li>
          <li>
            Issues / bugs:{" "}
            <a className="text-accent underline" href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
              github.com/jacobaraujo7/remote_pi/issues
            </a>
          </li>
        </ul>
        <p className="text-sm">License: MIT.</p>
      </DocsSection>
    </DocsShell>
  );
}

function DocsToc() {
  return (
    <nav aria-label="Table of contents" className="text-sm">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
        On this page
      </p>
      <ul className="flex flex-col gap-0.5">
        <TocItem href="#quick-start" label="Quick start">
          <TocItem href="#agent-network-30s" label="Agent network in 30s" sub />
        </TocItem>
        <TocItem href="#what-it-does" label="What it does">
          <TocItem href="#agent-network-layer" label="Agent network layer" sub />
          <TocItem href="#mobile-app-layer" label="Mobile app layer" sub />
        </TocItem>
        <TocItem href="#install" label="Install" />
        <TocItem href="#using-remote-pi" label={<>Using <InlineCode>/remote-pi</InlineCode></>} />
        <TocItem href="#pairing" label="Pairing a mobile device" />
        <TocItem href="#relay" label="The relay">
          <TocItem href="#community-relay" label="Community relay" sub />
          <TocItem href="#self-host" label="Self-host" sub />
          <TocItem href="#point-pi" label="Point Pi at your relay" sub />
        </TocItem>
        <TocItem href="#agent-network" label="Agent network deep dive" />
        <TocItem href="#protocol" label="Protocol & Security" />
        <TocItem href="#daemon-mode" label="Daemon mode">
          <TocItem href="#daemon-prereq" label="One-time setup" sub />
          <TocItem href="#daemon-per-folder" label="Per-folder workflow" sub />
          <TocItem href="#daemon-fleet" label="Fleet operations" sub />
          <TocItem href="#daemon-remove" label="Remove / uninstall" sub />
          <TocItem href="#daemon-logs" label="Logs" sub />
          <TocItem href="#daemon-caveats" label="Caveats" sub />
        </TocItem>
        <TocItem href="#commands" label="Command reference">
          <TocItem href="#commands-local" label="Local session" sub />
          <TocItem href="#commands-daemon" label="Daemon fleet" sub />
        </TocItem>
        <TocItem href="#config" label="Configuration files" />
        <TocItem href="#troubleshooting" label="Troubleshooting">
          <TocItem href="#footer-stuck" label="Stuck on pairing" sub />
          <TocItem href="#timeout-mobile" label="Mobile times out" sub />
          <TocItem href="#timeout-request" label="Reply never arrives" sub />
          <TocItem href="#one-pi-per-cwd" label="One Pi per cwd" sub />
        </TocItem>
        <TocItem href="#links" label="Links" />
      </ul>
    </nav>
  );
}

function TocItem({
  href,
  label,
  sub,
  children,
}: {
  href: string;
  label: React.ReactNode;
  sub?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        className={
          sub
            ? "block rounded py-1 pl-3 text-[13px] text-muted transition-colors hover:text-fg"
            : "block rounded py-1 font-medium text-fg transition-colors hover:text-accent"
        }
      >
        {label}
      </a>
      {children ? (
        <ul className="ml-2 border-l border-border-soft/70 pl-1">{children}</ul>
      ) : null}
    </li>
  );
}
