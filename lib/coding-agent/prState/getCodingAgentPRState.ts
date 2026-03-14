import redis from "@/lib/redis/connection";
import { buildPRStateKey } from "./buildPRStateKey";
import type { CodingAgentPRState } from "./types";

/**
 * Gets the shared PR state for a repo/branch from Redis.
 *
 * @param repo
 * @param branch
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
