#!/usr/bin/env node
/**
 * pi-schedule — OS-cron-backed task scheduler for the Pi coding agent.
 *
 * Part of the remote-pi mesh ecosystem. Schedules tasks via crontab and
 * delivers them through the UDS broker via pi-notify.
 *
 * Extension factory (default export) loaded by Pi SDK:
 *   pi -e $(pwd)/dist/index.js
 *
 * Commands:
 *   /schedule <text>         — Schedule a task (NL→cron via LLM, falls back to ask_user)
 *   /schedule list           — List all scheduled tasks
 *   /schedule remove <id>    — Remove a scheduled task
 *   /schedule pause <id>     — Pause a task without deleting it
 *   /schedule resume <id>    — Resume a paused task
 *
 * Tools:
 *   schedule_task()          — LLM-callable: schedule a task
 *   list_schedules()         — LLM-callable: list scheduled tasks
 *   remove_schedule()        — LLM-callable: remove a task
 *   pause_schedule()         — LLM-callable: pause a task
 *   resume_schedule()        — LLM-callable: resume a task
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionFactory,
} from "@earendil-works/pi-coding-agent";

import {
  addJob,
  listJobs,
  getJob,
  removeJob,
  setJobEnabled,
  nextRunFor,
  validateSchedule,
  type CronJob,
} from "./schedule_store.js";

import {
  crontabAdd,
  crontabRemove,
  crontabToggle,
  checkCrontabAvailable,
} from "./cron_manager.js";

import { humanReadableCron } from "./cron_human.js";

import { parseScheduleFromText, type ParsedSchedule } from "./schedule_llm.js";

// ── State ───────────────────────────────────────────────────────────────────

let _pi: ExtensionAPI | null = null;
let _targetAgent: string = "unknown";

// ── Constants ────────────────────────────────────────────────────────────────

const PI_NOTIFY_CMD = "pi-notify";

// ── Helpers ──────────────────────────────────────────────────────────────────

function _fmtJobRow(job: CronJob): string {
  const h = humanReadableCron(job.cron);
  const next = nextRunFor(job);
  const nextStr = next ? next.toISOString().replace("T", " ").slice(0, 16) : "—";
  const status = job.enabled ? "● active" : "○ paused";
  return `  ${job.id.padEnd(12)} ${h.padEnd(30)} ${nextStr.padEnd(16)} ${status}`;
}

function _fmtJobDetail(job: CronJob): string {
  const lines: string[] = [];
  lines.push(`  ID:      ${job.id}`);
  lines.push(`  Task:    ${job.task}`);
  lines.push(`  Cron:    ${job.cron}  (${humanReadableCron(job.cron)})`);
  const next = nextRunFor(job);
  lines.push(`  Next:    ${next ? next.toISOString().replace("T", " ").slice(0, 16) : "—"}`);
  lines.push(`  Status:  ${job.enabled ? "● active" : "○ paused"}`);
  if (job.last_run) lines.push(`  Last:    ${job.last_run}  (${job.last_status ?? "—"})`);
  lines.push(`  Created: ${job.created_at}`);
  return lines.join("\n");
}

// ── Command handlers ─────────────────────────────────────────────────────────

async function _cmdSchedule(text: string, ctx: ExtensionCommandContext): Promise<void> {
  // 1. Check crontab availability
  if (!checkCrontabAvailable()) {
    ctx.ui.notify(
      "[pi-schedule] crontab not found on this system. Install cron or use a different scheduler.",
      "error",
    );
    return;
  }

  if (!text || text.trim().length === 0) {
    ctx.ui.notify("[pi-schedule] Usage: /schedule <task description> — include a time like 'every 5 minutes'", "warning");
    return;
  }

  // 2. Parse via LLM — extract (cron, task) from natural language
  let parsed: ParsedSchedule;
  try {
    parsed = await parseScheduleFromText(text, ctx);
  } catch (err) {
    ctx.ui.notify(`[pi-schedule] Failed to parse schedule: ${err}`, "error");
    return;
  }

  // 3. If no schedule detected, ask the user
  if (!parsed.cron) {
    if (typeof ctx.askUser === "function") {
      const answer = await ctx.askUser({
        question: `When should "${parsed.task}" run?`,
        context: "Tell me when to run this task (e.g. 'every 5 minutes', 'daily at 9am', 'every Wednesday at 14:30')",
        allowFreeform: true,
      });
      if (!answer || !answer.trim()) {
        ctx.ui.notify("[pi-schedule] No schedule given — task not scheduled.", "warning");
        return;
      }
      parsed = await parseScheduleFromText(`${answer} ${parsed.task}`, ctx);
      if (!parsed.cron) {
        ctx.ui.notify("[pi-schedule] Could not parse that as a schedule. Use format like 'every 5 minutes'.", "error");
        return;
      }
    } else {
      ctx.ui.notify(
        "[pi-schedule] No schedule detected. Tell me when to run it (e.g. 'every 5 minutes', 'daily at 9am').",
        "warning",
      );
      return;
    }
  }

  // 4. Validate
  const validation = validateSchedule(parsed.cron);
  if (!validation.ok) {
    ctx.ui.notify(`[pi-schedule] Invalid schedule: ${validation.error}`, "error");
    return;
  }

  // 5. Persist
  const job = addJob({
    cron: parsed.cron,
    task: parsed.task,
    target_agent: _targetAgent,
  });

  // 6. Write to crontab
  const cronLine = `${job.cron} ${PI_NOTIFY_CMD} --source cron --agent-id ${_targetAgent} -m "job:${job.id}" --type scheduled`;
  try {
    crontabAdd(job.id, cronLine);
  } catch (err) {
    // Rollback
    removeJob(job.id);
    ctx.ui.notify(`[pi-schedule] Failed to write crontab: ${err}`, "error");
    return;
  }

  const human = humanReadableCron(job.cron);
  ctx.ui.notify(
    `[pi-schedule] Task scheduled (${job.id}) — "${parsed.task}" runs ${human}`,
    "info",
  );
}

function _cmdList(ctx: ExtensionCommandContext): void {
  const jobs = listJobs();
  if (jobs.length === 0) {
    ctx.ui.notify("[pi-schedule] No scheduled tasks.", "info");
    return;
  }

  ctx.ui.notify("[pi-schedule] Scheduled tasks:\n" + jobs.map(_fmtJobRow).join("\n"), "info");
}

function _cmdRemove(id: string, ctx: ExtensionCommandContext): void {
  const job = getJob(id);
  if (!job) {
    ctx.ui.notify(`[pi-schedule] No task with ID "${id}". Use /schedule list to see all.`, "warning");
    return;
  }

  crontabRemove(id);
  removeJob(id);
  ctx.ui.notify(`[pi-schedule] Removed task "${id}" — "${job.task}"`, "info");
}

function _cmdPause(id: string, ctx: ExtensionCommandContext): void {
  if (!getJob(id)) {
    ctx.ui.notify(`[pi-schedule] No task with ID "${id}".`, "warning");
    return;
  }

  crontabToggle(id, false);
  setJobEnabled(id, false);
  ctx.ui.notify(`[pi-schedule] Paused task "${id}"`, "info");
}

function _cmdResume(id: string, ctx: ExtensionCommandContext): void {
  if (!getJob(id)) {
    ctx.ui.notify(`[pi-schedule] No task with ID "${id}".`, "warning");
    return;
  }

  crontabToggle(id, true);
  setJobEnabled(id, true);
  ctx.ui.notify(`[pi-schedule] Resumed task "${id}"`, "info");
}

function _cmdDetail(id: string, ctx: ExtensionCommandContext): void {
  const job = getJob(id);
  if (!job) {
    ctx.ui.notify(`[pi-schedule] No task with ID "${id}".`, "warning");
    return;
  }
  ctx.ui.notify("[pi-schedule] Task details:\n" + _fmtJobDetail(job), "info");
}

// ── Extension factory ────────────────────────────────────────────────────────

const extension: ExtensionFactory = (pi: ExtensionAPI): void => {
  _pi = pi;

  // Capture the agent's mesh name on session start
  pi.on("session_start", (_event, ctx) => {
    const name = (ctx as { agentName?: string }).agentName;
    if (name) _targetAgent = name;
  });

  // ── Slash commands ──────────────────────────────────────────────────────

  pi.registerCommand("schedule", {
    description: "Schedule a task. Include when to run it (e.g. 'every 5 minutes', 'daily at 9am')",
    handler: async (args, ctx) => {
      await _cmdSchedule(args.trim(), ctx as ExtensionCommandContext);
    },
  });

  pi.registerCommand("schedule list", {
    description: "List all scheduled tasks with frequency and next run time",
    handler: async (_, ctx) => {
      _cmdList(ctx as ExtensionCommandContext);
    },
  });

  pi.registerCommand("schedule remove", {
    description: "Remove a scheduled task by ID",
    handler: async (args, ctx) => {
      _cmdRemove(args.trim(), ctx as ExtensionCommandContext);
    },
  });

  pi.registerCommand("schedule pause", {
    description: "Pause a scheduled task without deleting it",
    handler: async (args, ctx) => {
      _cmdPause(args.trim(), ctx as ExtensionCommandContext);
    },
  });

  pi.registerCommand("schedule resume", {
    description: "Resume a paused scheduled task",
    handler: async (args, ctx) => {
      _cmdResume(args.trim(), ctx as ExtensionCommandContext);
    },
  });

  // ── LLM Tools ───────────────────────────────────────────────────────────

  pi.registerTool({
    name: "schedule_task",
    label: "Schedule Task",
    description: "Schedule a recurring task via OS cron. Provide a cron expression or natural language schedule.",
    promptSnippet: "schedule_task({schedule, task, target_agent?}): schedule a recurring task. Returns {job_id, human, next_run}.",
    parameters: {
      type: "object",
      properties: {
        schedule: {
          type: "string",
          description: "Cron expression (e.g. '*/5 * * * *') or natural language (e.g. 'every 5 minutes', 'daily at 9am')",
        },
        task: {
          type: "string",
          description: "The task description to execute when the schedule fires",
        },
        target_agent: {
          type: "string",
          description: "Agent to deliver the task to (defaults to self)",
          optional: true,
        },
      },
      required: ["schedule", "task"],
    },
    execute: async (_toolCallId, params) => {
      const { schedule, task, target_agent } = params as { schedule: string; task: string; target_agent?: string };

      if (!checkCrontabAvailable()) {
        return {
          content: [{ type: "text", text: "crontab not available on this system" }],
          details: { error: "crontab_not_found" },
        };
      }

      // Validate / parse
      let cron = schedule;
      // Try as a raw cron expression first
      let validation = validateSchedule(cron);
      if (!validation.ok) {
        // Try parsing as natural language — we need a context for LLM calls,
        // so if we're in a tool context without a full ctx, accept NL strings
        // only if they look like cron (5-6 fields). Otherwise return error.
        return {
          content: [{ type: "text", text: `Invalid schedule: ${validation.error}` }],
          details: { error: validation.error },
        };
      }

      const target = target_agent ?? _targetAgent;
      const job = addJob({ cron, task, target_agent: target });

      const cronLine = `${job.cron} ${PI_NOTIFY_CMD} --source cron --agent-id ${target} -m "job:${job.id}" --type scheduled`;
      try {
        crontabAdd(job.id, cronLine);
      } catch (err) {
        removeJob(job.id);
        return {
          content: [{ type: "text", text: `Failed to write crontab: ${err}` }],
          details: { error: String(err) },
        };
      }

      const human = humanReadableCron(job.cron);
      const next = nextRunFor(job);
      const nextStr = next ? next.toISOString() : null;

      return {
        content: [{ type: "text", text: `Task scheduled (${job.id}) — "${task}" runs ${human}` }],
        details: {
          job_id: job.id,
          human,
          next_run: nextStr,
          created_at: job.created_at,
        },
      };
    },
  });

  pi.registerTool({
    name: "list_schedules",
    label: "List Schedules",
    description: "List all scheduled tasks with their frequency and next run time.",
    promptSnippet: "list_schedules(): returns array of scheduled jobs with id, human, next_run, enabled.",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      const jobs = listJobs();
      const items = jobs.map((j) => ({
        job_id: j.id,
        human: humanReadableCron(j.cron),
        task: j.task,
        enabled: j.enabled,
        next_run: nextRunFor(j)?.toISOString() ?? null,
        last_run: j.last_run ?? null,
        last_status: j.last_status ?? null,
        created_at: j.created_at,
      }));
      return {
        content: [{ type: "text", text: items.length === 0 ? "No scheduled tasks." : JSON.stringify(items, null, 2) }],
        details: { jobs: items },
      };
    },
  });

  pi.registerTool({
    name: "remove_schedule",
    label: "Remove Schedule",
    description: "Remove a scheduled task by its job ID.",
    promptSnippet: "remove_schedule({job_id}): removes a scheduled task from cron and registry.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "The job ID to remove (e.g. j_abc123)" },
      },
      required: ["job_id"],
    },
    execute: async (_toolCallId, params) => {
      const { job_id } = params as { job_id: string };
      const job = getJob(job_id);
      if (!job) {
        return {
          content: [{ type: "text", text: `No task with ID "${job_id}"` }],
          details: { removed: false },
        };
      }
      crontabRemove(job_id);
      removeJob(job_id);
      return {
        content: [{ type: "text", text: `Removed task "${job_id}" — "${job.task}"` }],
        details: { removed: true, job_id, task: job.task },
      };
    },
  });

  pi.registerTool({
    name: "pause_schedule",
    label: "Pause Schedule",
    description: "Pause a scheduled task without deleting it. It won't fire until resumed.",
    promptSnippet: "pause_schedule({job_id}): pauses a scheduled task.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "The job ID to pause" },
      },
      required: ["job_id"],
    },
    execute: async (_toolCallId, params) => {
      const { job_id } = params as { job_id: string };
      if (!getJob(job_id)) {
        return {
          content: [{ type: "text", text: `No task with ID "${job_id}"` }],
          details: { paused: false },
        };
      }
      crontabToggle(job_id, false);
      setJobEnabled(job_id, false);
      return {
        content: [{ type: "text", text: `Paused task "${job_id}"` }],
        details: { paused: true, job_id },
      };
    },
  });

  pi.registerTool({
    name: "resume_schedule",
    label: "Resume Schedule",
    description: "Resume a paused scheduled task.",
    promptSnippet: "resume_schedule({job_id}): resumes a paused scheduled task.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "The job ID to resume" },
      },
      required: ["job_id"],
    },
    execute: async (_toolCallId, params) => {
      const { job_id } = params as { job_id: string };
      if (!getJob(job_id)) {
        return {
          content: [{ type: "text", text: `No task with ID "${job_id}"` }],
          details: { resumed: false },
        };
      }
      crontabToggle(job_id, true);
      setJobEnabled(job_id, true);
      return {
        content: [{ type: "text", text: `Resumed task "${job_id}"` }],
        details: { resumed: true, job_id },
      };
    },
  });
};

export default extension;
