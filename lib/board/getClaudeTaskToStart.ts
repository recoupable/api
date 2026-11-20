import type { WatcherContext } from "@vercel/board";
import { CLAUDE_BOARD_LABEL } from "@/lib/board/claudeBoardLabel";

export type ClaudeBoardTask = { id: string; channel: string };

const TASK_EVENTS = new Set(["task.created", "task.ready", "task.reopened"]);

/**
 * Decides whether a board event should start Claude on a task. Only a root
 * task labeled `agent=claude`, ready and unclaimed, whose owner is a trusted
 * principal qualifies, because a task's text is instructions for whoever
 * claims it.
 *
 * @param event - The event a watcher received.
 * @param trustedPrincipals - Principal IDs allowed to hand Claude work.
 * @returns The task to start, or null to ignore the event.
 */
export function getClaudeTaskToStart(
  event: WatcherContext["event"],
  trustedPrincipals: string[],
): ClaudeBoardTask | null {
  const message = event.message;
  if (!message || message.re !== null || !message.task) return null;

  const isTaskEvent = TASK_EVENTS.has(event.type);
  const labeledNow =
    event.type === "labels.changed" &&
    (event.payload as { set?: Record<string, string> }).set?.[CLAUDE_BOARD_LABEL.key] ===
      CLAUDE_BOARD_LABEL.value;
  if (!isTaskEvent && !labeledNow) return null;

  if (message.labels?.[CLAUDE_BOARD_LABEL.key] !== CLAUDE_BOARD_LABEL.value) return null;

  const { task } = message;
  if (task.state !== "ready" || task.claim !== null) return null;
  if (!trustedPrincipals.includes(task.owner)) return null;

  return { id: message.id, channel: message.channel };
}
