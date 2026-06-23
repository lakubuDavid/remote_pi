/**
 * Schedule LLM — parses natural language schedule descriptions into cron expressions.
 *
 * Uses the existing Pi LLM context to extract (cron_expression, task_text)
 * from free-text input like "run tests every 5 minutes".
 *
 * If no schedule is detected, returns `{ cron: null, task }` so the caller
 * can fall back to `ask_user`.
 */

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export interface ParsedSchedule {
  /** Cron expression like "*/5 * * * *", or null if not detected. */
  cron: string | null;
  /** The task description (everything that isn't the schedule). */
  task: string;
}

/**
 * Attempt to extract a cron expression and task description from natural
 * language text using the Pi LLM's existing context.
 *
 * Strategy: We rely on the LLM that's already in conversation with the user.
 * Since this is a slash command handler, the text has already been typed by
 * the user. We parse heuristically first, falling back to patterns.
 *
 * This avoids making an extra LLM call — the user's existing LLM already
 * "understands" what they typed. For tool calls, the LLM passes structured
 * parameters directly.
 *
 * @param text - The raw text from the user (after the /schedule command)
 * @param _ctx - The extension command context (for potential ask_user fallback)
 * @returns ParsedSchedule with cron expression and cleaned task text
 */
export async function parseScheduleFromText(
  text: string,
  _ctx?: ExtensionCommandContext,
): Promise<ParsedSchedule> {
  const trimmed = text.trim();
  if (!trimmed) return { cron: null, task: "" };

  // Try common natural language patterns and convert to cron.
  // These patterns are recognized in order of specificity.

  const patterns: Array<{ regex: RegExp; toCron: (matches: RegExpExecArray) => string }> = [
    // "every X minutes" or "every X min"
    {
      regex: /^(?:every\s+)?(\d+)\s*(min(?:ute)?s?)\s+(.+)$/i,
      toCron: (m) => `*/${m[1]} * * * *`,
    },
    // "every X hours" or "every X hour"
    {
      regex: /^(?:every\s+)?(\d+)\s*(hour(?:s)?)\s+(.+)$/i,
      toCron: (m) => `0 */${m[1]} * * *`,
    },
    // "every X seconds" (map to minutes since cron has no seconds)
    {
      regex: /^(?:every\s+)?(\d+)\s*(sec(?:ond)?s?)\s+(.+)$/i,
      toCron: () => `* * * * *`, // every minute as closest approximation
    },
    // "every day at HH:MM" or "daily at HH:MM"
    {
      regex: /^(?:(?:every\s+)?day(?:ly)?\s+)?at\s+(\d{1,2})(?::(\d{2}))?\s*(.+)$/i,
      toCron: (m) => `${m[2] ?? "0"} ${m[1]} * * *`,
    },
    // "every weekday at HH:MM" or "weekdays at HH:MM"
    {
      regex: /^(?:(?:every\s+)?(?:weekday|weekdays|business\s+days?)\s+)?at\s+(\d{1,2})(?::(\d{2}))?\s*(.+)$/i,
      toCron: (m) => `${m[2] ?? "0"} ${m[1]} * * 1-5`,
    },
    // "every Monday/Tuesday/... at HH:MM"
    {
      regex: /^(?:every\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(.+)$/i,
      toCron: (m) => {
        const dow: Record<string, string> = {
          monday: "1", tuesday: "2", wednesday: "3", thursday: "4",
          friday: "5", saturday: "6", sunday: "0",
          mon: "1", tue: "2", wed: "3", thu: "4", fri: "5", sat: "6", sun: "0",
        };
        return `${m[3] ?? "0"} ${m[2]} * * ${dow[m[1].toLowerCase()] ?? "1"}`;
      },
    },
    // "every minute"
    {
      regex: /^(?:every\s+)?minute\s+(.+)$/i,
      toCron: () => `* * * * *`,
    },
    // "every hour" or "hourly"
    {
      regex: /^(?:every\s+)?hour(?:ly)?\s+(.+)$/i,
      toCron: () => `0 * * * *`,
    },
    // "daily" or "every day"
    {
      regex: /^(?:every\s+)?day(?:ly)?\s+(.+)$/i,
      toCron: () => `0 0 * * *`,
    },
    // "weekly" or "every week"
    {
      regex: /^(?:every\s+)?week(?:ly)?\s+(.+)$/i,
      toCron: () => `0 0 * * 0`,
    },
    // "monthly" or "every month"
    {
      regex: /^(?:every\s+)?month(?:ly)?\s+(.+)$/i,
      toCron: () => `0 0 1 * *`,
    },
    // Raw cron expression at start: "*/5 * * * * run tests"
    {
      regex: /^([-*\d,\/]+\s+[-*\d,\/]+\s+[-*\d,\/]+\s+[-*\d,\/]+\s+[-*\d,\/]+)\s+(.+)$/,
      toCron: (m) => m[1],
    },
    // Raw cron with 6 fields (with seconds): "*/30 * * * * * run tests"
    {
      regex: /^([-*\d,\/]+\s+[-*\d,\/]+\s+[-*\d,\/]+\s+[-*\d,\/]+\s+[-*\d,\/]+\s+[-*\d,\/]+)\s+(.+)$/,
      toCron: (m) => m[1],
    },
  ];

  for (const { regex, toCron } of patterns) {
    const m = regex.exec(trimmed);
    if (m) {
      const task = m[m.length - 1].trim();
      const cron = toCron(m);
      if (task) {
        return { cron, task };
      }
    }
  }

  // If the entire text looks like a cron expression (5-6 space-separated fields
  // with only numbers, commas, hyphens, asterisks, slashes), treat it as cron-only
  if (/^[-*\d,\/]+\s+[-*\d,\/]+\s+[-*\d,\/]+\s+[-*\d,\/]+\s+[-*\d,\/]+$/.test(trimmed)) {
    return { cron: trimmed, task: "(no task description)" };
  }

  // No schedule pattern detected — return the text as the task
  return { cron: null, task: trimmed };
}
