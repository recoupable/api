import redis from "@/lib/redis/connection";
import { buildPRStateKey } from "./buildPRStateKey";
import type { CodingAgentPRState } from "./types";

/**
 * Gets the shared PR state for a repo/branch from Redis.
 *
 * @param repo - Full repo identifier (e.g. "recoupable/api")
 * @param branch - Branch name to look up PR state for (e.g. "agent/fix-bug")
 * @returns The stored CodingAgentPRState, or null if no state exists for the key
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
