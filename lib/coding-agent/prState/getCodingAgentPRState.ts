import redis from "@/lib/redis/connection";
import { buildPRStateKey } from "./buildPRStateKey";
import type { CodingAgentPRState } from "./types";

/**
 * Get Coding Agent PRState.
 *
 * @param repo - Value for repo.
 * @param branch - Value for branch.
 * @returns - Computed result.
 */
export async function getCodingAgentPRState(
  repo: string,
  branch: string,
): Promise<CodingAgentPRState | null> {
  const key = buildPRStateKey(repo, branch);
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as CodingAgentPRState;
}
