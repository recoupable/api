import { getPackModelReadiness } from "./getPackModelReadiness";
import type { PackModelTask } from "./getPackModelEvidence";
/** Existing approvals do not waive recorded restrictions on a new provider effect. */
export function assertPackModelRestrictions(tasks: PackModelTask[]) {
  const report = getPackModelReadiness(tasks);
  const blocked = Object.entries(report.tasks).filter(([, entry]) => entry.restriction);
  if (blocked.length)
    throw new Error(
      `Pack provider restriction: ${blocked.map(([task, entry]) => `${task} (${entry.model}): ${entry.restriction}`).join("; ")}. No new provider work authorized; no substitution was made.`,
    );
}
