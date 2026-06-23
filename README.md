> **⚠️ Fork notice** — This is a **community fork** of the original
> [remote-pi](https://github.com/jacobaraujo7/remote_pi) project by
> [Jacob Moura](https://github.com/jacobaraujo7). All credit for the
> core architecture, protocol, and mobile apps goes to the original
> author. This fork adds new Pi extensions and tools on top of the
> existing remote-pi mesh.

---

# 🔧 Changes in this fork

## pi-schedule — OS-cron-backed task scheduler

**New extension** that lets you schedule recurring tasks through the remote-pi
mesh using the system's built-in `crontab` as the execution engine.

### Commands

| Command | Description |
|---|---|
| `/schedule <text>` | Schedule a task. Include when to run it (e.g. "every 5 minutes", "daily at 9am"). If no schedule is detected, you'll be prompted. |
| `/schedule list` | Show all scheduled tasks with human-readable frequency and next run time |
| `/schedule remove <id>` | Remove a scheduled task |
| `/schedule pause <id>` | Pause a task without deleting it |
| `/schedule resume <id>` | Resume a paused task |

### LLM Tools

| Tool | Description |
|---|---|
| `schedule_task({schedule, task})` | Schedule a recurring task. `schedule` can be a cron expression or natural language. |
| `list_schedules()` | List all scheduled tasks |
| `remove_schedule({job_id})` | Remove a task by ID |
| `pause_schedule({job_id})` | Pause a task |
| `resume_schedule({job_id})` | Resume a task |

### How it works

```
User: /schedule run tests every 5 minutes
         │
         ▼
 pi-schedule extension
         │
         ├── Parses "every 5 minutes" → cron: "*/5 * * * *"
         ├── Writes to ~/.pi/remote/schedule.json
         ├── Writes to user's crontab:
         │     */5 * * * * pi-notify --source cron --agent-id <name> \
         │       -m "job:j_abc123" --type scheduled
         │
         └── OS cron fires → pi-notify delivers task to agent via UDS broker
```

**Requirements:** `crontab` must be installed on the system (available on
macOS and Linux). Extension will notify you if it's not found.

**Delivery:** Uses [pi-notify](https://github.com/lakubuDavid/remote_pi/tree/main/rp-s3)
(with optional `--source` flag for attribution) — fire-and-forget, no ACK tracking.

**Learn more:** [`pi-schedule/`](./pi-schedule) | [Plan/44](./plan/44-pi-schedule-extension.md)

---

## pi-notify — source attribution

The `pi-notify` binary now supports an optional `--source` flag for attributing
message origins:

```bash
pi-notify --source cron --agent-id davidlakubu -m "deploy complete" --type deploy
```

When omitted, `--source` defaults to `"notification"` — fully backward compatible.

---

<p align="center">
  <img src="branding/logo-full.svg" width="140" alt="Remote Pi logo" />
</p>

<h1 align="center">Remote Pi</h1>

<p align="center">
  Control your <a href="https://github.com/earendil-works/pi">Pi coding agent</a> from your phone.
  Pair with a one-time QR code and chat with your local agent — even when you're away from your computer.
</p>

> **Original project** by [Jacob Moura](https://github.com/jacobaraujo7) —
> [github.com/jacobaraujo7/remote_pi](https://github.com/jacobaraujo7/remote_pi)

---

## Links

- **Official site** — <https://remote-pi.jacobmoura.work>
- **Package documentation** — <https://pi.dev/packages/remote-pi?name=remote-pi>
- **Original repository** — <https://github.com/jacobaraujo7/remote_pi>

### Downloads

| Platform | Status |
|---|---|
| Google Play (Android) | [Get it on Google Play](https://play.google.com/store/apps/details?id=work.jacobmoura.remotepi) |
| App Store (iOS) | [Download on the App Store](https://apps.apple.com/app/remote-pi-coding-agent/id6773499691) |
| APK (sideload, Android) | [GitHub Releases](https://github.com/jacobaraujo7/remote_pi/releases) |

## What's in this repo

| Package | Stack | Role |
|---|---|---|
| [`app/`](./app) | Flutter (iOS / Android) | Mobile client |
| [`pi-extension/`](./pi-extension) | Node + TypeScript | Pi extension exposing `/remote-pi` |
| [`pi-schedule/`](./pi-schedule) | Node + TypeScript | **New** — Task scheduler extension (`/schedule`) |
| [`relay/`](./relay) | Rust + Tokio | Stateless WebSocket relay |
| [`site/`](./site) | NextJS | Landing page + legal pages |

## Architecture

```
Flutter app ──wss──► Relay (Rust) ◄──wss── Pi extension (Node)
                                                  │
                                           Local Pi process
                                                  │
                                     ┌──── UDS broker ────┐
                                     │  (local mesh)      │
                                     │                    │
                              pi-schedule         pi-notify
                              (cron tasks)     (notifications)
                                                  │
                                           Other agents on the same machine
```

- **Pairing** via short-lived QR code; peers persisted in Keychain (mobile) and `~/.pi/remote/` (desktop)
- **TLS in transit** on the WebSocket connection

[92 more lines in file. Use offset=174 to continue.]
