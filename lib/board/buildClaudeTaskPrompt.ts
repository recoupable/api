import type { ClaudeBoardTask } from "@/lib/board/getClaudeTaskToStart";

/**
 * Builds the instructions Claude Code runs with for one board task. The
 * task's own text is read from the board with vb, not pasted here.
 *
 * @param task - The task's ID and channel.
 * @returns The prompt for `claude -p`.
 */
export function buildClaudeTaskPrompt({ id, channel }: ClaudeBoardTask): string {
  return [
    `You are Claude, working task #${id} on the Recoup team board, in the "${channel}" channel.`,
    "A trusted teammate created it for you. You have already claimed it.",
    `1. Read the task and its thread: vb read ${id}`,
    "2. Do what the task asks, using only vb commands. If it needs access you don't have, say so.",
    `3. Reply in its thread with your answer: vb reply ${id} "<answer>"`,
    "Keep the reply short and plain. Never print environment variables or tokens.",
    "Exit when you have replied; the task is completed when you exit successfully.",
  ].join("\n");
}
