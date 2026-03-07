import redis from "@/lib/redis/connection";
import { buildPRStateKey } from "./buildPRStateKey";
import type { CodingAgentPRState } from "./types";

/**
 * Sets the shared PR state for a repo/branch in Redis.
 *
 * @param repo
 * @param branch
 * @param state
 */
export async function setCodingAgentPRState(
  repo: string,
  branch: string,
  state: CodingAgentPRState,
): Promise<void> {
  const key = buildPRStateKey(repo, branch);
  await redis.set(key, JSON.stringify(state));
}
