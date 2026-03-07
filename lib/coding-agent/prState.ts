import redis from "@/lib/redis/connection";
import type { CodingAgentPR } from "./types";

export interface CodingAgentPRState {
  status: "running" | "pr_created" | "updating" | "merged" | "failed" | "no_changes";
  snapshotId?: string;
  branch: string;
  repo: string;
  prs?: CodingAgentPR[];
}

const KEY_PREFIX = "coding-agent:pr";

/**
 * Builds the Redis key for a given repo and branch.
 *
 * @param repo
 * @param branch
 */
export function buildPRStateKey(repo: string, branch: string): string {
  return `${KEY_PREFIX}:${repo}:${branch}`;
}

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
