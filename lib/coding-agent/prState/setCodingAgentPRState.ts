import redis from "@/lib/redis/connection";
import { buildPRStateKey } from "./buildPRStateKey";
import type { CodingAgentPRState } from "./types";

/**
 * Sets the shared PR state for a repo/branch in Redis.
 *
 * @param repo - Full repo identifier (e.g. "recoupable/api")
 * @param branch - Branch name to store PR state for (e.g. "agent/fix-bug")
 * @param state - The PR state object to persist, including status, prs, snapshotId, and branch
 */
export async function setCodingAgentPRState(
  repo: string,
  branch: string,
  state: CodingAgentPRState,
): Promise<void> {
  const key = buildPRStateKey(repo, branch);
  await redis.set(key, JSON.stringify(state));
}
