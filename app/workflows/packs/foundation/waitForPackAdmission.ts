import { sleep } from "workflow";
import { pollPackAdmission } from "@/lib/content/packs/foundation/pollPackAdmission";
import type { PackActor } from "@/lib/content/packs/packTypes";
import { startPackAdmissionStep } from "./startPackAdmissionStep";
import { readPackAdmissionStep } from "./readPackAdmissionStep";
/** Unwired: no production caller, self-admission, dispatch, provider work or settlement. */
export async function waitForPackAdmission(actor: PackActor, jobId: string) {
  const start = await startPackAdmissionStep();
  return pollPackAdmission(actor, jobId, start, { read: readPackAdmissionStep, sleepUntil: sleep });
}
