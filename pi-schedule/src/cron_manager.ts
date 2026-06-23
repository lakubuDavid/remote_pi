/**
 * Cron manager — reads/writes the user's crontab via `crontab -`.
 *
 * Each scheduled task gets a crontab entry annotated with a marker comment:
 *   # pi-schedule:j_abc123
 *   */5 * * * * pi-notify --source cron --agent-id foo -m "job:j_abc123" --type scheduled
 *
 * On pause, the command line is commented out:
 *   # pi-schedule:j_abc123 (paused)
 *   # */5 * * * * pi-notify --source cron --agent-id foo -m "job:j_abc123" --type scheduled
 *
 * Concurrency is guarded by a lock file at ~/.pi/remote/crontab.lock.
 */

import { execSync, type ExecSyncOptions } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_INTERVAL_MS = 200;

function lockPath(): string {
  const root = process.env["REMOTE_PI_HOME"] || homedir();
  return join(root, ".pi", "remote", "crontab.lock");
}

function scheduleDir(): string {
  return dirname(lockPath());
}

/**
 * Acquire an exclusive file lock on the crontab lock file.
 * Uses mkdir as an atomic create (race-safe on all POSIX systems).
 */
function acquireLock(): boolean {
  const lockDir = lockPath();
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      mkdirSync(lockDir, { recursive: false }); // fails if exists
      return true;
    } catch {
      // Lock held by another process — wait and retry
      const waitMs = Math.min(LOCK_RETRY_INTERVAL_MS, deadline - Date.now());
      if (waitMs <= 0) break;
      // Busy-wait with short sleep
      const start = Date.now();
      while (Date.now() - start < waitMs) {
        // spin
      }
    }
  }
  return false;
}

function releaseLock(): void {
  try {
    // Only remove if it's actually a directory (our lock)
    if (existsSync(lockPath())) {
      // Use rmdir which only succeeds on empty directories
      execSync(`rmdir "${lockPath()}" 2>/dev/null || true`, { shell: true });
    }
  } catch {
    // Best-effort
  }
}

/**
 * Read current crontab as string. Returns empty string if no crontab exists.
 */
function readCrontab(): string {
  try {
    const opts: ExecSyncOptions = { encoding: "utf8", timeout: 5_000 };
    return execSync("crontab -l 2>/dev/null || true", opts) ?? "";
  } catch {
    return "";
  }
}

/**
 * Write a new crontab from string content.
 */
function writeCrontab(content: string): void {
  const opts: ExecSyncOptions = { timeout: 5_000 };
  execSync(`crontab -`, { ...opts, input: content });
}

/**
 * Run a function with the crontab lock held.
 */
function withLock<T>(fn: () => T): T {
  const acquired = acquireLock();
  if (!acquired) {
    throw new Error(
      "Could not acquire crontab lock — another process may be updating the crontab. Try again.",
    );
  }
  try {
    return fn();
  } finally {
    releaseLock();
  }
}

// ── Public API ─────────────────────────────────────────────────────────────//

/**
 * Check if crontab is available on this system.
 */
export function checkCrontabAvailable(): boolean {
  try {
    execSync("which crontab 2>/dev/null", { timeout: 2_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Add a cron job to the user's crontab.
 * Inserts a marker comment + the cron line.
 */
export function crontabAdd(jobId: string, cronLine: string): void {
  withLock(() => {
    const existing = readCrontab();

    // Check if already present (idempotent)
    if (existing.includes(`# pi-schedule:${jobId}`)) {
      // Update in place — remove old entry, add new
      crontabRemove(jobId);
    }

    const entry = `# pi-schedule:${jobId}\n${cronLine}\n`;
    writeCrontab(existing + entry);
  });
}

/**
 * Remove a cron job from the user's crontab by job ID.
 */
export function crontabRemove(jobId: string): void {
  withLock(() => {
    const existing = readCrontab();
    if (!existing.includes(`# pi-schedule:${jobId}`)) return; // not found

    const lines = existing.split("\n");
    const filtered: string[] = [];
    let skip = false;
    for (const line of lines) {
      if (line.trim() === `# pi-schedule:${jobId}` || line.trim().startsWith(`# pi-schedule:${jobId} (`)) {
        skip = true;
        continue;
      }
      if (skip) {
        // Skip the next non-comment line (the cron command)
        if (line.trim() !== "" && !line.trim().startsWith("#")) {
          skip = false;
          continue;
        }
        skip = false;
      }
      filtered.push(line);
    }
    writeCrontab(filtered.join("\n"));
  });
}

/**
 * Toggle a cron job on (uncomment) or off (comment out).
 */
export function crontabToggle(jobId: string, enabled: boolean): void {
  withLock(() => {
    const existing = readCrontab();
    if (!existing.includes(`# pi-schedule:${jobId}`)) return;

    const lines = existing.split("\n");
    const updated: string[] = [];
    let inBlock = false;

    for (const line of lines) {
      if (line.trim() === `# pi-schedule:${jobId}` || line.trim() === `# pi-schedule:${jobId} (paused)`) {
        inBlock = true;
        updated.push(enabled
          ? `# pi-schedule:${jobId}`
          : `# pi-schedule:${jobId} (paused)`);
        continue;
      }
      if (inBlock) {
        inBlock = false;
        if (enabled) {
          // Uncomment: remove leading #
          updated.push(line.replace(/^#\s*/, ""));
        } else {
          // Comment out: add # if not already
          updated.push(line.trim().startsWith("#") ? line : `# ${line}`);
        }
        continue;
      }
      updated.push(line);
    }
    writeCrontab(updated.join("\n"));
  });
}

/**
 * Ensure the crontab lock directory exists.
 */
export function ensureLockDir(): void {
  mkdirSync(scheduleDir(), { recursive: true });
}
