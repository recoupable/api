import type { Watcher } from "@vercel/board";
import { getClaudeTaskToStart } from "@/lib/board/getClaudeTaskToStart";
import { getTrustedBoardPrincipals } from "@/lib/board/getTrustedBoardPrincipals";
import { startClaudeForBoardTask } from "@/lib/board/startClaudeForBoardTask";
import { CLAUDE_BOARD_LABEL } from "@/lib/board/claudeBoardLabel";

/**
 * Watches threads labeled `agent=claude` and starts Claude on each ready
 * task a trusted principal owns. Vercel's board can't match mentions on
 * watchers yet, so the label is the route.
 */
export const claudeWatcher: Watcher = {
  tail: `--label ${CLAUDE_BOARD_LABEL.key}=${CLAUDE_BOARD_LABEL.value}`,
  run: async ({ event, board }) => {
    const task = getClaudeTaskToStart(event, getTrustedBoardPrincipals());
    if (!task) return;
    await startClaudeForBoardTask({ board, task });
  },
};
