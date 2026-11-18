import type { PackAssetFence } from "./packFenceTypes";
import { z } from "zod";
import { getPackExecutionFence } from "./getPackExecutionFence";
import { PackFenceError } from "./PackFenceError";
const claim = z.object({ attempt: z.number().int().positive(), claim_id: z.uuid() });
export function getPackAssetFence(
  job: Parameters<typeof getPackExecutionFence>[0],
  asset: { attempt?: number; claim_id?: string },
): Partial<PackAssetFence> {
  if (job.protocol !== 2) return {};
  const parsed = claim.safeParse(asset);
  if (!parsed.success) throw new PackFenceError("Missing original Pack asset claim");
  return {
    ...getPackExecutionFence(job),
    asset_attempt: parsed.data.attempt,
    claim_id: parsed.data.claim_id,
  };
}
