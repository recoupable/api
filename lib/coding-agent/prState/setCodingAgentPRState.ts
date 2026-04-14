import redis from "@/lib/redis/connection";
import { buildPRStateKey } from "./buildPRStateKey";
import type { CodingAgentPRState } from "./types";

/**
 * Set Coding Agent PRState.
 *
 * @param repo - Parameter.
 * @param branch - Parameter.
 * @param state - Parameter.
 * @returns - Result.
 */
export async function setCodingAgentPRState(
  repo: string,
  branch: string,
  state: CodingAgentPRState,
): Promise<void> {
  const key = buildPRStateKey(repo, branch);
  await redis.set(key, JSON.stringify(state));
}
