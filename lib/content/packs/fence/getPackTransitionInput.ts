import { z } from "zod";
import type { PackProtocol2Admission } from "./packFenceTypes";
import { PackFenceError } from "./PackFenceError";
const transition = z.strictObject({
  request_id: z.uuid(),
  source_execution_id: z.uuid().nullable(),
  source_execution_version: z.number().int().nonnegative(),
  source_claim_id: z.uuid().optional(),
  asset_attempt: z.number().int().nonnegative().optional(),
});
/** Original caller admission, never repaired by reading current execution state. */
export function getPackTransitionInput(admission: PackProtocol2Admission | undefined) {
  if (!admission) return {};
  const result = transition.safeParse(admission.transition);
  if (!result.success)
    throw new PackFenceError("Original protocol-2 transition admission required");
  return result.data;
}
