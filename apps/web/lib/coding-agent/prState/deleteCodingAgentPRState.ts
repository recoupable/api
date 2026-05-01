import redis from "@/lib/redis/connection";
import { buildPRStateKey } from "./buildPRStateKey";

/**
 * Deletes the shared PR state for a repo/branch from Redis.
 *
 * @param repo
 * @param branch
 */
export async function deleteCodingAgentPRState(repo: string, branch: string): Promise<void> {
  const key = buildPRStateKey(repo, branch);
  await redis.del(key);
}
