import redis from "@/lib/redis/connection";
import { buildPRStateKey } from "./buildPRStateKey";
import type { CodingAgentPRState } from "./types";

/**
 * Set Coding Agent PRState.
 *
 * @param repo - Value for repo.
 * @param branch - Value for branch.
 * @param state - Value for state.
 * @returns - Computed result.
 */
export async function setCodingAgentPRState(
  repo: string,
  branch: string,
  state: CodingAgentPRState,
): Promise<void> {
  const key = buildPRStateKey(repo, branch);
  await redis.set(key, JSON.stringify(state));
}
