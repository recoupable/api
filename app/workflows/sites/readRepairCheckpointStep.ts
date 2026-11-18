import { readSiteRepairControl } from "@/lib/sites/production/readSiteRepairControl";
import type { Site } from "@/lib/sites/schema";

/** Journal the wall-clock and workspace/revision read; replay reuses this completed checkpoint. */
export async function readRepairCheckpointStep(site: Site, accountId: string) {
  "use step";
  const control = await readSiteRepairControl(site, accountId);
  return { ...control, now: Date.now() };
}
