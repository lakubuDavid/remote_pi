# Plan/44 — pi-schedule: OS-cron-backed task scheduler

**Date:** 2026-06-22
**Status:** Draft
**Owner:** TBD

---

## Goal

A minimal extension that lets users schedule tasks via the remote-pi mesh using
**OS cron (`crontab`)** as the execution engine. The extension handles all
intelligence (NL→cron parsing, registry, crontab manipulation); delivery is
delegated to `pi-notify` (enhanced with source attribution).

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         Extension Layer (Node/TS)                   │
│                                                                     │
│  pi-schedule extension                                              │
│    ├── /schedule <text>          (slash command)                    │
│    ├── /schedule list            (slash command)                    │
│    ├── /schedule remove <id>     (slash command)                    │
│    ├── /schedule pause <id>      (slash command)                    │
│    ├── /schedule resume <id>     (slash command)                    │
│    │                                                               │
│    ├── schedule_task()           (LLM tool)                        │
│    ├── list_schedules()          (LLM tool)                        │
│    ├── remove_schedule()         (LLM tool)                        │
│    ├── pause_schedule()          (LLM tool)                        │
│    ├── resume_schedule()         (LLM tool)                        │
│    │                                                               │
│    └── schedule_store.ts         (JSON registry CRUD)              │
│         ~/.pi/remote/schedule.json                                 │
│                                                                     │
├────────────────────────────────────────────────────────────────────┤
│                      Cron Layer (OS-level)                          │
│                                                                     │
│  User's crontab                                                     │
│    │  */5 * * * * pi-notify --source cron \                        │
│    │    --agent-id davidlakubu -m "job:j_abc123" --type scheduled   │
│    │                                                               │
│    └──► OS cron daemon fires → pi-notify delivers to broker        │
│                                                                     │
├────────────────────────────────────────────────────────────────────┤
│                      Delivery Layer (Go binary)                     │
│                                                                     │
│  pi-notify (enhanced)                                               │
│    ├── --source <string>    attribution tag (optional, defaults     │
│    │                          to "notification")                   │
│    ├── --agent-id <addr>    target agent                            │
│    ├── -m <text>            message body                            │
│    ├── --type <string>      message type (scheduled, alert, …)     │
│    └── --title <string>     optional title                          │
│                                                                     │
│  Envelope body format (v2 with source):                             │
│    { "source": "cron",                                              │
│      "type": "scheduled",                                           │
│      "subtype": "cron_job",                                         │
│      "job_id": "j_abc123",                                          │
│      "task": "run tests",                                           │
│      "cwd": "/home/user/project",                                   │
│      "fired_at": "2026-06-22T14:30:00Z" }                          │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. User schedules a task (slash command)

```
User: /schedule run tests every 5 minutes
         │
         ▼
  Extension handler receives "run tests every 5 minutes"
         │
         ├── LLM (existing context) parses:
         │     "every 5 minutes"   → cron: "*/5 * * * *"
         │     "run tests"         → task text
         │
         ├── validateSchedule("*/5 * * * *")  ✓
         │
         ├── check crontab availability       ✓
         │
         ├── write to schedule.json:
         │     { id: "j_abc123",
         │       cron: "*/5 * * * *",
         │       human: "every 5 minutes",
         │       task: "run tests",
         │       target_agent: "davidlakubu",
         │       enabled: true, ... }
         │
         ├── write to crontab (via crontab -l | ... | crontab -):
         │     */5 * * * * pi-notify --source cron \
         │       --agent-id davidlakubu \
         │       -m "job:j_abc123" \
         │       --type scheduled
         │
         └── notify user: "Task scheduled (j_abc123) — runs every 5 minutes"
```

### 2. No schedule detected → ask user

```
User: /schedule run tests
         │
         ▼
  Extension receives "run tests"
         │
         ├── LLM parses: no schedule found
         │
         └── call ask_user():
               "When should this task run?
                (e.g. 'every 5 minutes', 'daily at 9am',
                 'every Wednesday at 14:30')"
```

### 3. LLM schedules a task (tool call)

```
Agent's LLM (during a conversation):
  → decides to call schedule_task()
  → passes { schedule: "0 9 * * 1-5", task: "send daily standup reminder" }

Extension:
  → validates + persists + writes crontab
  → returns { job_id: "j_def456", human: "weekdays at 09:00" }
```

### 4. Cron fires → delivery

```
OS cron daemon (every 5 minutes):
         │
         ▼
  pi-notify --source cron --agent-id davidlakubu \
    -m "job:j_abc123" --type scheduled
         │
         ├── Connects to broker.sock
         ├── Registers as transient "pi-notify-cron"
         ├── Sends envelope:
         │     from: "pi-notify"
         │     to: "davidlakubu"
         │     body: { source: "cron",
         │              type: "scheduled",
         │              job_id: "j_abc123",
         │              task: "run tests",
         │              fired_at: "..." }
         └── Disconnects
```

The target agent (`davidlakubu`) receives the message in its inbox on the next
turn. The LLM sees a new message from `pi-notify` and processes the task.

---

## Extension Modules

| Module | File | Role |
|---|---|---|
| **Entry point** | `src/index.ts` | Extension factory: registers commands + tools. |
| **Schedule LLM** | `src/schedule_llm.ts` | Calls the Pi SDK's LLM (via existing conversation context) to extract `(cron_expression, task_text)` from free text. Falls back to `ask_user` when no schedule is detected. |
| **Cron manager** | `src/cron_manager.ts` | Reads/writes OS crontab via `crontab -l` → edit → `crontab -`. Handles idempotent add/remove/pause by marking entries with `# pi-schedule:j_abc123` comments. Checks `crontab` availability at startup. |
| **Schedule store** | `src/schedule_store.ts` | JSON CRUD at `~/.pi/remote/schedule.json`. Stores job_id, cron, task, target_agent, enabled, created_at, last_run, last_status. |
| **Human-readable cron** | `src/cron_human.ts` | Wraps `cronstrue` to display `*/5 * * * *` as `"every 5 minutes"`. Also computes next run time via `croner`. |
| **Source attribution** | *(in pi-notify repo)* | Add `--source` flag to `pi-notify`. The flag value is embedded in the envelope body so the recipient agent knows the origin. |

---

## LLM Tools

| Tool | Parameters | Returns |
|---|---|---|
| **`schedule_task`** | `schedule: string` (cron or NL), `task: string`, `target_agent?: string` (default: self) | `{ job_id, human, next_run, created_at }` |
| **`list_schedules`** | *(none)* | `[{ job_id, human, task, enabled, next_run, last_run, last_status }]` |
| **`remove_schedule`** | `job_id: string` | `{ removed: bool }` |
| **`pause_schedule`** | `job_id: string` | `{ paused: bool, job_id }` |
| **`resume_schedule`** | `job_id: string` | `{ resumed: bool, job_id }` |

---

## Slash Commands

| Command | Handler |
|---|---|
| `/schedule <text>` | Parses text via LLM. If schedule found → add task. If not → `ask_user`. |
| `/schedule list` | Reads `schedule.json`, shows table with ID, human freq, next run, status. |
| `/schedule remove <id>` | Removes from registry + deletes crontab line. |
| `/schedule pause <id>` | Comments out crontab line (prefixed with `#`). Sets `enabled: false`. |
| `/schedule resume <id>` | Uncomments crontab line. Sets `enabled: true`. |

---

## pi-notify Enhancement

Add an **optional** `--source` flag to `pi-notify`:

```
pi-notify --source cron --agent-id davidlakubu -m "job:j_abc123" --type scheduled
pi-notify --agent-id davidlakubu -m "job:j_abc123" --type scheduled
# ^ no --source, defaults to "notification"
```

The `--source` field lets agents filter/prioritize messages by origin (cron job,
CI build, file watcher, manual notify, etc.). When omitted the behavior is
identical to current pi-notify — fully backward compatible.

Changes required in `pi-notify`:
1. Add optional `--source` CLI flag (default: `"notification"`)
2. Set `body["source"]` to the flag value when provided

---

## Files Changed / Created

### New files (pi-schedule extension)
```
remote_pi/pi-schedule/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              (extension factory)
│   ├── schedule_llm.ts       (NL→cron parsing)
│   ├── cron_manager.ts       (crontab read/write)
│   ├── schedule_store.ts     (JSON registry)
│   └── cron_human.ts         (human-readable display)
├── README.md
└── LICENSE
```

### Changed files (pi-notify)
```
remote_pi/rp-s3/pi-notify/   (or wherever pi-notify lives)
├── main.go                   (add --source flag)
```

---

## Crontab Entry Format

Each scheduled task gets one line in the user's crontab:

```
# pi-schedule:j_abc123
*/5 * * * * pi-notify --source cron --agent-id davidlakubu -m "job:j_abc123" --type scheduled
```

On pause, the line is commented out:

```
# pi-schedule:j_abc123 (paused)
# */5 * * * * pi-notify --source cron --agent-id davidlakubu -m "job:j_abc123" --type scheduled
```

The `# pi-schedule:j_abc123` marker lets the extension find its own lines even
if the user has other crontab entries.

---

## Cross-Platform Notes

| OS | Cron available | Fallback |
|---|---|---|
| macOS | `crontab` works, but `launchd` is preferred | v1 targets `crontab` only; `launchd` support can be added later |
| Linux | `crontab` via cronie / cron daemon | — |
| Windows | No native cron | v1 not supported; could use Task Scheduler in future |

If `crontab` is not found on the system → extension sends a notification to the
user and refuses to schedule.

---

## What's Left Out (v1 scope)

- ❌ No web UI or dashboard
- ❌ No cross-PC scheduling (tasks run on the machine where scheduled)
- ❌ No execution history beyond last_run/last_status
- ❌ No task dependencies or DAGs
- ❌ No launchd / systemd-timer / Task Scheduler backends
- ❌ No catch-up on missed runs
- ❌ No wake-daemon-if-down support (defer to supervisor's cron for that)
- ❌ No pi-scheduler binary — delivery is via pi-notify only

---

## Resolved Decisions

| Decision | Choice |
|---|---|
| Delivery ACK tracking | **Fire-and-forget** — pi-notify sends once and exits. No tracking. |
| Crontab concurrency | **Lock file** at `~/.pi/remote/crontab.lock`. Extension acquires lock before reading/writing crontab, releases after. |
| `--source` flag | **Optional** — defaults to `"notification"` when absent. Fully backward-compatible. |

## Known Limitation (v1)

- **Agent rename → stale crontab entries**: The crontab entry hardcodes
  `--agent-id <name>`. If the agent is renamed, the cron entry points to a
  non-existent address and the task silently fails. v1 does **not** handle
  this — rename is infrequent and the user can `remove` + re-`schedule`.
