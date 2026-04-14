import redis from "@/lib/redis/connection";
import { buildPRStateKey } from "./buildPRStateKey";

/**
 * Delete Coding Agent PRState.
 *
 * @param repo - Parameter.
 * @param branch - Parameter.
 * @returns - Result.
 */
export async function deleteCodingAgentPRState(repo: string, branch: string): Promise<void> {
  const key = buildPRStateKey(repo, branch);
  await redis.del(key);
}
