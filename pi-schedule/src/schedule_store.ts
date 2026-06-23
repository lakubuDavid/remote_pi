/**
 * Schedule store — JSON persistence for scheduled tasks.
 *
 * Manages a registry at `~/.pi/remote/schedule.json` with CRUD operations,
 * cron validation via croner, and next-run computation.
 *
 * Mirrors the pattern used by remote-pi's daemon/cron_registry.ts but is
 * independent (this extension manages OS crontab, not the supervisor).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { Cron } from "croner";

/** Minimum allowed interval between runs (60s — guards against pileup). */
export const MIN_INTERVAL_MS = 60_000;

/** A scheduled task. */
export interface CronJob {
  id: string;
  cron: string;
  task: string;
  target_agent: string;
  enabled: boolean;
  created_at: string;
  last_run?: string;
  last_status?: string;
}

interface ScheduleRegistry {
  jobs: CronJob[];
}

function storePath(): string {
  const root = process.env["REMOTE_PI_HOME"] || homedir();
  return join(root, ".pi", "remote", "schedule.json");
}

function loadRegistry(): ScheduleRegistry {
  const path = storePath();
  if (!existsSync(path)) return { jobs: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return { jobs: [] };
    const arr = (parsed as { jobs?: unknown }).jobs;
    if (!Array.isArray(arr)) return { jobs: [] };
    const jobs: CronJob[] = [];
    for (const item of arr) {
      const job = coerceJob(item);
      if (job) jobs.push(job);
    }
    return { jobs };
  } catch {
    return { jobs: [] };
  }
}

function saveRegistry(reg: ScheduleRegistry): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(reg, null, 2) + "\n");
}

export function listJobs(): CronJob[] {
  return loadRegistry().jobs;
}

export function getJob(id: string): CronJob | undefined {
  return loadRegistry().jobs.find((j) => j.id === id);
}

export interface NewJobInput {
  cron: string;
  task: string;
  target_agent: string;
}

export function addJob(input: NewJobInput): CronJob {
  const reg = loadRegistry();
  const job: CronJob = {
    id: freshId(reg.jobs),
    cron: input.cron,
    task: input.task,
    target_agent: input.target_agent,
    enabled: true,
    created_at: new Date().toISOString(),
  };
  reg.jobs.push(job);
  saveRegistry(reg);
  return job;
}

export function removeJob(id: string): boolean {
  const reg = loadRegistry();
  const idx = reg.jobs.findIndex((j) => j.id === id);
  if (idx === -1) return false;
  reg.jobs.splice(idx, 1);
  saveRegistry(reg);
  return true;
}

export function setJobEnabled(id: string, enabled: boolean): boolean {
  const reg = loadRegistry();
  const job = reg.jobs.find((j) => j.id === id);
  if (!job) return false;
  job.enabled = enabled;
  saveRegistry(reg);
  return true;
}

export function recordRun(id: string, at: string, status: string): void {
  const reg = loadRegistry();
  const job = reg.jobs.find((j) => j.id === id);
  if (!job) return;
  job.last_run = at;
  job.last_status = status;
  saveRegistry(reg);
}

// ── Schedule validation ──────────────────────────────────────────────────────

export interface ScheduleValidation {
  ok: boolean;
  error?: string;
  intervalMs?: number;
}

export function validateSchedule(schedule: string, tz?: string): ScheduleValidation {
  let cron: Cron;
  try {
    cron = new Cron(schedule, tz ? { timezone: tz } : {});
  } catch (e) {
    return { ok: false, error: `invalid cron expression: ${(e as Error).message}` };
  }
  try {
    const n1 = cron.nextRun();
    const n2 = n1 ? cron.nextRun(n1) : null;
    if (!n1 || !n2) return { ok: false, error: "schedule has no upcoming runs" };
    const intervalMs = n2.getTime() - n1.getTime();
    if (intervalMs < MIN_INTERVAL_MS) {
      return {
        ok: false,
        intervalMs,
        error: `schedule too frequent: ~${Math.round(intervalMs / 1000)}s between runs (minimum is 60s)`,
      };
    }
    return { ok: true, intervalMs };
  } finally {
    cron.stop();
  }
}

export function nextRunFor(job: CronJob): Date | null {
  try {
    const cron = new Cron(job.cron);
    const n = cron.nextRun();
    cron.stop();
    return n;
  } catch {
    return null;
  }
}

// ── Internals ────────────────────────────────────────────────────────────────

function freshId(existing: CronJob[]): string {
  for (let i = 0; i < 1000; i++) {
    const id = `j_${randomBytes(4).toString("hex")}`;
    if (!existing.some((j) => j.id === id)) return id;
  }
  throw new Error("schedule id space exhausted");
}

function coerceJob(item: unknown): CronJob | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  if (typeof o["id"] !== "string") return null;
  if (typeof o["cron"] !== "string") return null;
  if (typeof o["task"] !== "string") return null;
  const job: CronJob = {
    id: o["id"],
    cron: o["cron"],
    task: o["task"],
    target_agent: typeof o["target_agent"] === "string" ? o["target_agent"] : "unknown",
    enabled: o["enabled"] !== false,
    created_at: typeof o["created_at"] === "string" ? o["created_at"] : new Date(0).toISOString(),
  };
  if (typeof o["last_run"] === "string") job.last_run = o["last_run"];
  if (typeof o["last_status"] === "string") job.last_status = o["last_status"];
  return job;
}
