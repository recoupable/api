import redis from "@/lib/redis/connection";
import { buildPRStateKey } from "./buildPRStateKey";

/**
 * Deletes the shared PR state for a repo/branch from Redis.
 *
 * @param repo - Full repo identifier (e.g. "recoupable/api")
 * @param branch - Branch name whose PR state should be removed (e.g. "agent/fix-bug")
 */
export async function deleteCodingAgentPRState(repo: string, branch: string): Promise<void> {
  const key = buildPRStateKey(repo, branch);
  await redis.del(key);
}
