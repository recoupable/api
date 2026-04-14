import redis from "@/lib/redis/connection";
import { buildPRStateKey } from "./buildPRStateKey";

/**
 * Delete Coding Agent PRState.
 *
 * @param repo - Value for repo.
 * @param branch - Value for branch.
 * @returns - Computed result.
 */
export async function deleteCodingAgentPRState(repo: string, branch: string): Promise<void> {
  const key = buildPRStateKey(repo, branch);
  await redis.del(key);
}
