import { createPackFoundationPlan } from "@/lib/content/packs/foundation/createPackFoundationPlan";
import type { PackSnapshot } from "@/lib/content/packs/packTypes";
import type { PackFoundationSelection } from "@/lib/content/packs/foundation/packFoundationSchema";
export async function planPackFoundationStep(
  snapshot: PackSnapshot,
  selection: PackFoundationSelection,
) {
  "use step";
  return createPackFoundationPlan(snapshot, selection);
}
planPackFoundationStep.maxRetries = 0;
