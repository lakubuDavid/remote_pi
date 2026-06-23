/**
 * Human-readable cron — converts cron expressions to plain English.
 *
 * Wraps cronstrue for display and croner for next-run computation.
 */

import { Cron } from "croner";

/**
 * Convert a cron expression to a human-readable string.
 * Falls back to the raw expression if cronstrue fails or is unavailable.
 */
export function humanReadableCron(cronExpr: string): string {
  // Try cronstrue if available
  try {
    // Dynamic import — cronstrue may not be installed in all environments
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cronstrue = require("cronstrue");
    return cronstrue.toString(cronExpr);
  } catch {
    // Fallback: compute interval from croner
    return fallbackHumanReadable(cronExpr);
  }
}

/**
 * Fallback human-readable generation using croner.
 * Works without cronstrue — computes interval between next two runs.
 */
function fallbackHumanReadable(cronExpr: string): string {
  try {
    const c = new Cron(cronExpr);
    const n1 = c.nextRun();
    const n2 = n1 ? c.nextRun(n1) : null;
    c.stop();

    if (!n1) return cronExpr;

    // Single-run (non-recurring) schedule
    if (!n2) {
      return `once at ${n1.toLocaleString()}`;
    }

    const ms = n2.getTime() - n1.getTime();
    const seconds = Math.round(ms / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 120) return `every ${seconds} seconds`;
    if (minutes < 120) return `every ${minutes} minute${minutes !== 1 ? "s" : ""}`;
    if (hours < 48) return `every ${hours} hour${hours !== 1 ? "s" : ""}`;
    if (days < 7) return `every ${days} day${days !== 1 ? "s" : ""}`;

    // Try to detect day-of-week patterns
    const minute = cronExpr.split(" ")[1] ?? "*";
    const hour = cronExpr.split(" ")[2] ?? "*";
    const dayOfMonth = cronExpr.split(" ")[3] ?? "*";
    const month = cronExpr.split(" ")[4] ?? "*";
    const dayOfWeek = cronExpr.split(" ")[5] ?? "*";

    if (dayOfWeek !== "*" && dayOfMonth === "*") {
      const days: Record<string, string> = {
        "0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday",
        "4": "Thursday", "5": "Friday", "6": "Saturday", "7": "Sunday",
      };
      const parts = dayOfWeek.split(",").map((d) => days[d.trim()] ?? d.trim()).join(", ");
      const h = hour !== "*" ? ` at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}` : "";
      return `every ${parts}${h}`;
    }

    if (dayOfMonth !== "*") {
      const h = hour !== "*" ? ` at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}` : "";
      return `day ${dayOfMonth} of month${h}`;
    }

    return cronExpr; // fallback
  } catch {
    return cronExpr;
  }
}

/**
 * Get the next run time for a cron expression.
 */
export function nextRun(cronExpr: string): Date | null {
  try {
    const c = new Cron(cronExpr);
    const n = c.nextRun();
    c.stop();
    return n;
  } catch {
    return null;
  }
}
