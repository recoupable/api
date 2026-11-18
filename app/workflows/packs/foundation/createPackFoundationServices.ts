import { preparePackStep } from "../preparePackStep";
import { producePackAssetStep } from "../producePackAssetStep";
import { settleBoundedPackStep } from "../settleBoundedPackStep";
import { readPackFoundationStep } from "./readPackFoundationStep";
import { planPackFoundationStep } from "./planPackFoundationStep";
import { bindPackFoundationFilesStep } from "./bindPackFoundationFilesStep";
import { persistPackFoundationStep } from "./persistPackFoundationStep";
import { signPackFoundationFileStep } from "./signPackFoundationFileStep";
import type { PackActor } from "@/lib/content/packs/packTypes";
import type { PackFoundationServices } from "@/lib/content/packs/foundation/packFoundationServices";
/** Unwired single-admitted-run ports. Actor/job are passed explicitly to every effect step. */
export function createPackFoundationServices(
  actor: PackActor,
  jobId: string,
): PackFoundationServices {
  const scope = (input: PackActor, id: string) => {
    if (
      id !== jobId ||
      input.accountId !== actor.accountId ||
      input.organizationId !== actor.organizationId
    )
      throw new Error("Foundation service scope mismatch");
  };
  return {
    read: (a, id) => {
      scope(a, id);
      return readPackFoundationStep(a, id);
    },
    prepare: (a, id) => {
      scope(a, id);
      return preparePackStep(a, id);
    },
    persist: (a, job, record) => {
      scope(a, job.id);
      return persistPackFoundationStep(a, job, record);
    },
    produce: (a, job, id) => {
      scope(a, job.id);
      return producePackAssetStep(a, job, id);
    },
    settle: (a, id, error) => {
      scope(a, id);
      return settleBoundedPackStep(a, id, error);
    },
    createPlan: (snapshot, selection) => {
      scope(actor, snapshot.job.id);
      return planPackFoundationStep(snapshot, selection);
    },
    bindFiles: (plan, asset) => bindPackFoundationFilesStep(actor, jobId, plan, asset),
    signFile: file => signPackFoundationFileStep(actor, jobId, file),
  };
}
