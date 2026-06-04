import type { Metadata } from "next";
import Link from "next/link";
import { DocsSection, DocsSubsection, InlineCode } from "@/components/docs-shell";
import { CodeBlock } from "@/components/code-block";
import { Callout } from "@/components/callout";
import { Pager } from "@/components/pager";
import { RevealController } from "@/components/landing/reveal-controller";

export const metadata: Metadata = {
  title: "Daemon mode",
  description:
    "Keep a Pi agent alive 24/7: install the supervisor (launchd / systemd --user), register a folder as a daemon, and manage the fleet from one CLI.",
};

export default function DaemonTutorial() {
  return (
    <div className="page">
      <div className="page-body">
        <div className="wrap">
          <div className="tut">
            <header className="page-head reveal" style={{ maxWidth: "none" }}>
              <span className="eyebrow">Tutorial · 4 of 4</span>
              <h1>Daemon mode</h1>
              <p className="lede">
                So far your agents only run while a terminal is open. Daemon
                mode keeps a folder running as a background agent that survives
                logout, restarts on crash, and answers your phone at 3am. This
                is the <em>how</em>; for the <em>why</em> — and how it compares
                to all-in-one platforms — see <Link href="/why">Why Pi</Link>.
              </p>
            </header>

            <article className="prose">
              <DocsSection id="model" title="The shape of it">
          <p>
            One <strong className="text-fg">supervisor</strong> runs per
            machine. Under it sit N background agents — one per folder you
            promote. The supervisor is a normal user service:{" "}
            <InlineCode>launchd</InlineCode> on macOS,{" "}
            <InlineCode>systemd --user</InlineCode> on Linux. It starts at login,
            survives reboots, and respawns any agent that crashes.
          </p>
          <Callout variant="warning" title="Lock down tool permissions first">
            A daemon inherits the same Pi tool permissions your interactive
            session has — <InlineCode>Bash</InlineCode>,{" "}
            <InlineCode>Edit</InlineCode>, <InlineCode>Write</InlineCode> all run{" "}
            <strong className="text-fg">without a prompt</strong>, because no one
            is at the keyboard to approve them. Configure Pi&apos;s tool
            permissions to taste <em className="text-fg">before</em> you promote
            a folder to a 24/7 daemon. A tool-approval gate is on the roadmap.
          </Callout>
        </DocsSection>

        <DocsSection id="install" title="1. Install the supervisor (once per machine)">
          <p>From inside Pi:</p>
          <CodeBlock code="/remote-pi install" label="In Pi" language="text" />
          <p>That single command does two things:</p>
          <ul className="ml-6 list-disc space-y-2">
            <li>
              Installs and activates the user-level supervisor service (
              <InlineCode>launchd</InlineCode> /{" "}
              <InlineCode>systemd --user</InlineCode>), so it auto-starts at
              login and after reboot.
            </li>
            <li>
              Symlinks the <InlineCode>remote-pi</InlineCode> and{" "}
              <InlineCode>pi-supervisord</InlineCode> CLIs into{" "}
              <InlineCode>~/.local/bin/</InlineCode> so you can manage daemons
              from any shell. If that directory isn&apos;t on your{" "}
              <InlineCode>$PATH</InlineCode>, the command prints the line to add.
            </li>
          </ul>
          <p className="text-sm">
            This is a separate, explicit opt-in — it is{" "}
            <strong className="text-fg">not</strong> part of the regular setup
            wizard. You only run it on machines where you want 24/7 agents.
          </p>
        </DocsSection>

        <DocsSection id="create" title="2. Promote a folder to a daemon">
          <p>
            First make sure the folder is configured the normal way — run{" "}
            <InlineCode>/remote-pi</InlineCode> in it once (the wizard), and pair
            your phone if you want to reach it remotely. Then register it:
          </p>
          <CodeBlock
            code={`remote-pi create ~/Movies --name "Video Editor"
# → Daemon registered: id=4e39152d name="Video Editor" cwd=/Users/you/Movies · started`}
            label="Shell"
            language="bash"
          />
          <p>
            The id is a stable hash of the folder path (
            <InlineCode>sha256(realpath)[:8]</InlineCode>), so it survives moves
            and is the same on every machine. With the supervisor running,{" "}
            <InlineCode>create</InlineCode>{" "}
            <strong className="text-fg">starts the daemon right away</strong> —
            there is no separate start step. It restarts on crash and comes back
            after a reboot on its own.
          </p>
          <Callout variant="note" title="One daemon per folder">
            The by-path id rejects a second daemon in the same directory at{" "}
            <InlineCode>create</InlineCode> time. Pairing stays interactive — a
            daemon reuses the keypair and paired devices from the earlier{" "}
            <InlineCode>/remote-pi</InlineCode> session in that folder; it
            doesn&apos;t show a QR itself.
          </Callout>
        </DocsSection>

        <DocsSection id="fleet" title="3. Manage the fleet">
          <p>
            Every command works as a Pi slash command (
            <InlineCode>/remote-pi …</InlineCode>) and, once the CLI is linked,
            as a plain shell command (<InlineCode>remote-pi …</InlineCode>):
          </p>
          <CodeBlock
            code={`remote-pi daemons                  # list registered daemons + state
remote-pi daemon status            # pid, uptime, restart count
remote-pi daemon send 4e39152d "Cut the first 30s of the latest clip"
remote-pi daemon restart           # restart all
remote-pi daemon stop              # stop all`}
            label="Fleet commands"
            language="bash"
          />
          <p>
            A daemon receives a prompt as if a user typed it; its response flows
            back through the same mesh and relay you configured — your phone
            sees it live, and other agents on the machine see it over the local
            mesh.
          </p>
          <DocsSubsection title="Where the logs are">
            <CodeBlock
              code={`# Linux
journalctl --user -u remote-pi-supervisord -f

# macOS
tail -f ~/.pi/remote/supervisord.log`}
              label="Logs"
              language="bash"
            />
            <p>
              Each daemon&apos;s output is forwarded into the supervisor log with
              a <InlineCode>[&lt;cwd&gt;]</InlineCode> prefix, so one stream shows
              the whole fleet.
            </p>
          </DocsSubsection>
        </DocsSection>

        <DocsSection id="cleanup" title="Removing a daemon">
          <CodeBlock
            code={`remote-pi remove <id>              # unregister one daemon (folder config kept)
remote-pi uninstall                # remove the supervisor service (registry kept)`}
            label="Cleanup"
            language="bash"
          />
          <p>
            <InlineCode>uninstall</InlineCode> is reversible — re-running{" "}
            <InlineCode>/remote-pi install</InlineCode> later brings every
            registered daemon back. Full flags and paths are in the{" "}
            <Link href="/docs#daemon-mode" className="text-accent underline">
              reference docs
            </Link>
            .
          </p>
        </DocsSection>

            </article>

            <Pager
              prev={{ href: "/tutorials/mesh-remote", label: "Remote mesh" }}
            />
          </div>
        </div>
      </div>
      <RevealController />
    </div>
  );
}
