import { z } from "zod";
import { PackFenceError } from "./PackFenceError";
const identity = z.object({
  revision: z.number().int().positive(),
  execution_id: z.uuid(),
  execution_version: z.number().int().positive(),
});
export function getPackLaunchFence(job: unknown) {
  const parsed = identity.safeParse(job);
  if (!parsed.success) throw new PackFenceError("Missing original Pack execution identity");
  return {
    expected_revision: parsed.data.revision,
    execution_id: parsed.data.execution_id,
    execution_version: parsed.data.execution_version,
  };
}
