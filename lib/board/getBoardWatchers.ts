import type { Watcher } from "@vercel/board";
import { claudeWatcher } from "@/lib/board/claudeWatcher";
import { CLAUDE_BOARD_PROFILE } from "@/lib/board/claudeBoardProfile";

/**
 * Returns the watchers this deployment registers on the team board. Only
 * production registers any: previews register their watchers too, and each
 * would start its own agent run for the same task.
 *
 * @returns Watchers keyed by ID, which is also the profile their writes use.
 */
export function getBoardWatchers(): Record<string, Watcher> {
  if (process.env.VERCEL_ENV !== "production") return {};
  return { [CLAUDE_BOARD_PROFILE]: claudeWatcher };
}
